// VoxGarden control platform: accounts, stations and media over a small JSON API.
// Run: node apps/control/src/server.ts   (Node 24+, no dependencies)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type EngineStation, importTrack, listenUrl, mediaDir, reload, removeTrack, writeConfig } from './engine.ts';
import {
  type User, migrate, validateSignup, createUser, verifyLogin, startSession, endSession, readToken,
  sessionCookie, clearCookie, currentUser, tooManyAttempts, recordFailure, clearFailures,
} from './auth.ts';

const STUDIO_DIR = resolve(import.meta.dirname, '../../studio');
const STUDIO_FILES: Record<string, { name: string; type: string }> = {
  '/index.html': { name: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { name: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { name: 'style.css', type: 'text/css; charset=utf-8' },
};
const SECURE_COOKIE = process.env.VG_SECURE_COOKIE === '1'; // set to 1 behind HTTPS

const db = new DatabaseSync(process.env.VG_DB ?? 'voxgarden.db');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  bitrate INTEGER NOT NULL DEFAULT 64,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
db.exec(`CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  filename TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
migrate(db);

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_UPLOAD = 200 * 1024 * 1024;

// Every station, for the engine config. Never sent to clients.
const allStations = () => db.prepare('SELECT slug, name, bitrate FROM stations ORDER BY id').all() as unknown as EngineStation[];

const myStations = (userId: number) => db.prepare(
  `SELECT s.slug, s.name, s.bitrate, m.role FROM stations s
   JOIN station_members m ON m.station_id = s.id WHERE m.user_id = ? ORDER BY s.id`,
).all(userId) as unknown as (EngineStation & { role: string })[];

// Returns the station only if this user is a member of it. Non-members get the
// same 404 as a missing station, so slugs of other people's stations don't leak.
function stationFor(user: User, slug: string) {
  return db.prepare(
    `SELECT s.id, s.slug, m.role FROM stations s
     JOIN station_members m ON m.station_id = s.id WHERE s.slug = ? AND m.user_id = ?`,
  ).get(slug, user.id) as { id: number; slug: string; role: string } | undefined;
}

function send(res: ServerResponse, code: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(code, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    const v = JSON.parse((await readBody(req, 10_000)).toString() || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw Object.assign(new Error('invalid JSON'), { status: 400 });
  }
}

// CSRF guard for state-changing requests: the Studio sends this header, and a
// cross-site form or image tag cannot. SameSite=Lax on the cookie is a second layer.
const isWrite = (m?: string) => m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
const hasCsrfHeader = (req: IncomingMessage) => req.headers['x-vg-request'] === '1';

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

    // Studio UI (static, fixed file list so no path traversal is possible)
    if (req.method === 'GET') {
      const file = STUDIO_FILES[url.pathname === '/' ? '/index.html' : url.pathname];
      if (file) {
        res.writeHead(200, { 'content-type': file.type, 'cache-control': 'no-cache' });
        return res.end(readFileSync(join(STUDIO_DIR, file.name)));
      }
    }

    if (isWrite(req.method) && !hasCsrfHeader(req)) return send(res, 403, { error: 'missing request header' });

    // ---- accounts ----
    if (req.method === 'POST' && url.pathname === '/auth/signup') {
      const { email, name, password } = await readJson(req);
      const problem = validateSignup(email, name, password);
      if (problem) return send(res, 400, { error: problem });
      const user = createUser(db, email as string, name as string, password as string);
      if (!user) return send(res, 409, { error: 'An account with this email already exists. Try logging in.' });
      const token = startSession(db, user.id);
      return send(res, 201, { user }, { 'set-cookie': sessionCookie(token, SECURE_COOKIE) });
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const { email, password } = await readJson(req);
      const key = `${req.socket.remoteAddress}|${String(email).toLowerCase()}`;
      if (tooManyAttempts(key)) return send(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
      const user = verifyLogin(db, email, password);
      if (!user) {
        recordFailure(key);
        return send(res, 401, { error: 'Email or password is wrong' });
      }
      clearFailures(key);
      const token = startSession(db, user.id);
      return send(res, 200, { user }, { 'set-cookie': sessionCookie(token, SECURE_COOKIE) });
    }

    if (req.method === 'POST' && url.pathname === '/auth/logout') {
      const token = readToken(req);
      if (token) endSession(db, token);
      return send(res, 200, { ok: true }, { 'set-cookie': clearCookie });
    }

    // ---- everything below needs a signed-in user ----
    const user = currentUser(db, req);
    if (!user) return send(res, 401, { error: 'Please log in' });

    if (req.method === 'GET' && url.pathname === '/auth/me') return send(res, 200, { user });

    if (req.method === 'GET' && url.pathname === '/stations') {
      return send(res, 200, myStations(user.id).map((s) => ({ ...s, listen: listenUrl(s.slug) })));
    }

    if (req.method === 'POST' && url.pathname === '/stations') {
      const { name, slug } = await readJson(req);
      if (typeof name !== 'string' || !name.trim() || name.length > 80) return send(res, 400, { error: 'Station name is required (max 80 characters)' });
      if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 40) return send(res, 400, { error: 'Web address can use lowercase letters, numbers and hyphens' });
      try {
        db.exec('BEGIN');
        const r = db.prepare('INSERT INTO stations (slug, name) VALUES (?, ?)').run(slug, name.trim());
        db.prepare("INSERT INTO station_members (station_id, user_id, role) VALUES (?, ?, 'owner')").run(r.lastInsertRowid, user.id);
        db.exec('COMMIT');
      } catch {
        db.exec('ROLLBACK');
        return send(res, 409, { error: 'That web address is taken. Try another.' });
      }
      mediaDir(slug);
      writeConfig(allStations());
      await reload();
      return send(res, 201, { slug, name: name.trim(), role: 'owner', listen: listenUrl(slug) });
    }

    if (parts[0] === 'stations' && parts[2] === 'media') {
      const st = stationFor(user, parts[1] ?? '');
      if (!st) return send(res, 404, { error: 'No such station' });

      // POST /stations/:slug/media?filename=song.mp3   (raw audio body)
      if (req.method === 'POST' && parts.length === 3) {
        const filename = url.searchParams.get('filename') ?? '';
        if (!/\.(mp3|ogg|opus|wav|flac|m4a|aac)$/i.test(filename)) return send(res, 400, { error: 'Only audio files (mp3, wav, flac, ogg, opus, m4a, aac)' });
        const body = await readBody(req, MAX_UPLOAD);
        const tmp = mkdtempSync(join(tmpdir(), 'vg-'));
        try {
          const tmpFile = join(tmp, 'upload');
          writeFileSync(tmpFile, body);
          const saved = importTrack(st.slug, tmpFile, filename);
          db.prepare('INSERT INTO media (station_id, filename, bytes) VALUES (?, ?, ?)').run(st.id, saved, body.length);
          return send(res, 201, { filename: saved, bytes: body.length });
        } finally {
          rmSync(tmp, { recursive: true, force: true });
        }
      }

      // GET /stations/:slug/media
      if (req.method === 'GET' && parts.length === 3) {
        const rows = db.prepare('SELECT id, filename, bytes, created_at FROM media WHERE station_id = ? ORDER BY id DESC').all(st.id);
        return send(res, 200, rows);
      }

      // DELETE /stations/:slug/media/:id
      if (req.method === 'DELETE' && parts.length === 4) {
        const row = db.prepare('SELECT id, filename FROM media WHERE station_id = ? AND id = ?')
          .get(st.id, Number(parts[3])) as { id: number; filename: string } | undefined;
        if (!row) return send(res, 404, { error: 'No such track' });
        removeTrack(st.slug, row.filename);
        db.prepare('DELETE FROM media WHERE id = ?').run(row.id);
        return send(res, 200, { ok: true });
      }
    }

    send(res, 404, { error: 'not found' });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    send(res, status, { error: status === 500 ? 'server error' : (e as Error).message });
    if (status === 500) console.error(e);
  }
});

// Regenerate engine config on boot so the DB is the source of truth.
writeConfig(allStations());
const port = Number(process.env.PORT ?? 4000);
server.listen(port, '127.0.0.1', () => console.log(`control platform on http://127.0.0.1:${port}`));
