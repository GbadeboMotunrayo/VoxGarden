// VoxGarden control platform, v0: stations + media over a tiny JSON API.
// Run: node apps/control/src/server.ts   (Node 24+, no dependencies)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type EngineStation, importTrack, listenUrl, mediaDir, reload, removeTrack, writeConfig } from './engine.ts';

const STUDIO_DIR = resolve(import.meta.dirname, '../../studio');
const STUDIO_FILES: Record<string, { name: string; type: string }> = {
  '/index.html': { name: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { name: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/style.css': { name: 'style.css', type: 'text/css; charset=utf-8' },
};

const db = new DatabaseSync(process.env.VG_DB ?? 'voxgarden.db');
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

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_UPLOAD = 200 * 1024 * 1024;

const allStations = () => db.prepare('SELECT slug, name, bitrate FROM stations ORDER BY id').all() as unknown as EngineStation[];

function send(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json' });
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/stations') {
      return send(res, 200, allStations().map((s) => ({ ...s, listen: listenUrl(s.slug) })));
    }

    if (req.method === 'POST' && url.pathname === '/stations') {
      const { name, slug } = JSON.parse((await readBody(req, 10_000)).toString() || '{}');
      if (typeof name !== 'string' || !name.trim() || name.length > 80) return send(res, 400, { error: 'name required (max 80 chars)' });
      if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 40) return send(res, 400, { error: 'slug must be lowercase letters, digits, hyphens' });
      try {
        db.prepare('INSERT INTO stations (slug, name) VALUES (?, ?)').run(slug, name.trim());
      } catch {
        return send(res, 409, { error: 'slug already taken' });
      }
      mediaDir(slug);
      writeConfig(allStations());
      await reload();
      return send(res, 201, { slug, name: name.trim(), listen: listenUrl(slug) });
    }

    // POST /stations/:slug/media?filename=song.mp3   (raw audio body)
    if (req.method === 'POST' && parts[0] === 'stations' && parts[2] === 'media' && parts.length === 3) {
      const st = db.prepare('SELECT id, slug FROM stations WHERE slug = ?').get(parts[1]) as { id: number; slug: string } | undefined;
      if (!st) return send(res, 404, { error: 'no such station' });
      const filename = url.searchParams.get('filename') ?? '';
      if (!/\.(mp3|ogg|opus|wav|flac|m4a|aac)$/i.test(filename)) return send(res, 400, { error: 'filename must end in an audio extension' });
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
    if (req.method === 'GET' && parts[0] === 'stations' && parts[2] === 'media' && parts.length === 3) {
      const rows = db.prepare(
        'SELECT m.id, m.filename, m.bytes, m.created_at FROM media m JOIN stations s ON s.id = m.station_id WHERE s.slug = ? ORDER BY m.id DESC',
      ).all(parts[1]);
      return send(res, 200, rows);
    }

    // DELETE /stations/:slug/media/:id
    if (req.method === 'DELETE' && parts[0] === 'stations' && parts[2] === 'media' && parts.length === 4) {
      const row = db.prepare(
        'SELECT m.id, m.filename FROM media m JOIN stations s ON s.id = m.station_id WHERE s.slug = ? AND m.id = ?',
      ).get(parts[1], Number(parts[3])) as { id: number; filename: string } | undefined;
      if (!row) return send(res, 404, { error: 'no such track' });
      removeTrack(parts[1], row.filename);
      db.prepare('DELETE FROM media WHERE id = ?').run(row.id);
      return send(res, 200, { ok: true });
    }

    // Studio UI (static, fixed file list so no path traversal is possible)
    if (req.method === 'GET') {
      const file = STUDIO_FILES[url.pathname === '/' ? '/index.html' : url.pathname];
      if (file) {
        res.writeHead(200, { 'content-type': file.type, 'cache-control': 'no-cache' });
        return res.end(readFileSync(join(STUDIO_DIR, file.name)));
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
