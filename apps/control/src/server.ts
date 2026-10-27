// VoxGarden control platform: accounts, stations and media over a small JSON API.
// Run: node apps/control/src/server.ts   (Node 24+, no dependencies)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdtempSync, rmSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { type EngineStation, ensureRunning, importTrack, listenUrl, mediaDir, mountStatus, playNow, reconcile, removeTrack, streamOrigin } from './engine.ts';
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
const PORT = Number(process.env.PORT ?? 4000);
// Public address of this platform, used in share links and link previews.
const PUBLIC_BASE = (process.env.VG_PUBLIC_BASE ?? `http://localhost:${PORT}`).replace(/\/$/, '');

// Public station page (FR-10): no login. Fixed file list, like the Studio.
const PUBLIC_DIR = resolve(import.meta.dirname, '../../public');
const PUBLIC_FILES: Record<string, { name: string; type: string }> = {
  '/public/station.js': { name: 'station.js', type: 'text/javascript; charset=utf-8' },
  '/public/station.css': { name: 'station.css', type: 'text/css; charset=utf-8' },
  '/public/default-logo.svg': { name: 'default-logo.svg', type: 'image/svg+xml' },
};
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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

// Station profile fields (FR-02). Added with ALTER so older databases upgrade in place.
const stationCols = new Set((db.prepare('PRAGMA table_info(stations)').all() as { name: string }[]).map((c) => c.name));
for (const [col, def] of [
  ['description', "TEXT NOT NULL DEFAULT ''"],
  ['category', "TEXT NOT NULL DEFAULT ''"],
  ['language', "TEXT NOT NULL DEFAULT ''"],
  ['country', "TEXT NOT NULL DEFAULT ''"],
  ['city', "TEXT NOT NULL DEFAULT ''"],
  ['logo_file', "TEXT NOT NULL DEFAULT ''"],
  ['logo_version', 'INTEGER NOT NULL DEFAULT 0'],
  ['harbor_password', "TEXT NOT NULL DEFAULT ''"], // live input secret, never sent to clients
]) {
  if (!stationCols.has(col)) db.exec(`ALTER TABLE stations ADD COLUMN ${col} ${def}`);
}

// Give stations created before live input existed their own live-input secret.
for (const r of db.prepare("SELECT id FROM stations WHERE harbor_password = ''").all() as { id: number }[]) {
  db.prepare('UPDATE stations SET harbor_password = ? WHERE id = ?').run(randomBytes(18).toString('base64url'), r.id);
}

// Scheduling (FR-08): play a library track at a set time. filename is copied so the
// history still reads correctly after a track is removed from the library.
db.exec(`CREATE TABLE IF NOT EXISTS schedule (
  id INTEGER PRIMARY KEY,
  station_id INTEGER NOT NULL REFERENCES stations(id),
  media_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  starts_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'missed', 'failed', 'cancelled')),
  sent_at INTEGER,
  lateness_ms INTEGER,
  rid TEXT,
  error TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
db.exec('CREATE INDEX IF NOT EXISTS schedule_due ON schedule (status, starts_at)');

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_UPLOAD = 200 * 1024 * 1024;
const MAX_LOGO = 2 * 1024 * 1024;
const DATA_DIR = resolve(import.meta.dirname, '../../../data');
const LOGO_DIR = join(DATA_DIR, 'logos');
mkdirSync(LOGO_DIR, { recursive: true });

// Fixed lists keep the directory filterable later (Globe). Served to the UI via /meta/options.
const CATEGORIES = ['News & Talk', 'Music', 'Education', 'Campus', 'Faith', 'Sports', 'Community',
  'Business', 'Culture & Language', 'Entertainment', 'Other'];
const LANGUAGES = ['English', 'Nigerian Pidgin', 'Yoruba', 'Hausa', 'Igbo', 'French', 'Arabic', 'Swahili', 'Other'];

type Details = { description: string; category: string; language: string; country: string; city: string };

// Validates profile fields. On create every field is checked; on edit only the ones sent.
function validateDetails(input: Record<string, unknown>, partial: boolean): { error: string } | { values: Partial<Details> } {
  const out: Partial<Details> = {};
  const text = (k: keyof Details, max: number, label: string) => {
    if (input[k] === undefined && (partial || k !== 'description')) return null;
    const v = input[k] ?? '';
    if (typeof v !== 'string' || v.trim().length > max) return `${label} must be at most ${max} characters`;
    out[k] = v.trim();
    return null;
  };
  const pick = (k: 'category' | 'language', list: string[], label: string) => {
    if (input[k] === undefined && partial) return null;
    if (typeof input[k] !== 'string' || !list.includes(input[k] as string)) return `Choose a ${label}`;
    out[k] = input[k] as string;
    return null;
  };
  const err = text('description', 500, 'Description') ?? pick('category', CATEGORIES, 'category')
    ?? pick('language', LANGUAGES, 'language') ?? text('country', 60, 'Country') ?? text('city', 60, 'City');
  return err ? { error: err } : { values: out };
}

// Only real PNG, JPEG or WebP images are accepted as logos (checked by content, not name).
function imageType(b: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;

const STATION_FIELDS = 's.slug, s.name, s.bitrate, s.description, s.category, s.language, s.country, s.city, s.logo_file, s.logo_version';
type StationRow = Omit<EngineStation, 'id' | 'harbor_password'> & Details & { logo_file: string; logo_version: number; role?: string };

function presentStation(s: StationRow) {
  const { logo_file, logo_version, ...rest } = s;
  return { ...rest, logo: logo_file ? `/logos/${logo_file}?v=${logo_version}` : null, listen: listenUrl(s.slug) };
}

// Engine view of a station. Includes the live-input secret, so never sent to clients.
const ENGINE_FIELDS = 'id, slug, name, bitrate, harbor_password';
const engineStation = (id: number) => db.prepare(`SELECT ${ENGINE_FIELDS} FROM stations WHERE id = ?`).get(id) as unknown as EngineStation;
// A station's process runs once it has audio; before that there is nothing to play.
const stationsOnAir = () => db.prepare(
  `SELECT ${ENGINE_FIELDS} FROM stations s WHERE EXISTS (SELECT 1 FROM media m WHERE m.station_id = s.id) ORDER BY id`,
).all() as unknown as EngineStation[];
const hasMedia = (id: number) => !!db.prepare('SELECT 1 FROM media WHERE station_id = ? LIMIT 1').get(id);

const myStations = (userId: number) => db.prepare(
  `SELECT ${STATION_FIELDS}, m.role FROM stations s
   JOIN station_members m ON m.station_id = s.id WHERE m.user_id = ? ORDER BY s.id`,
).all(userId) as unknown as StationRow[];

// The public view of a station: profile fields only (no owner, no secrets).
function publicStation(slug: string) {
  const s = db.prepare(`SELECT ${STATION_FIELDS} FROM stations s WHERE s.slug = ?`).get(slug) as unknown as StationRow | undefined;
  if (!s) return null;
  const { role: _r, ...rest } = presentStation(s);
  return { ...rest, stream: listenUrl(s.slug), page: `${PUBLIC_BASE}/s/${s.slug}` };
}

const getStation = (id: number) => db.prepare(`SELECT ${STATION_FIELDS} FROM stations s WHERE s.id = ?`).get(id) as unknown as StationRow;

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

    // Public: station logos (fixed name pattern, so no path traversal) and form options.
    if (req.method === 'GET' && parts[0] === 'logos' && parts.length === 2) {
      const m = /^([a-z0-9-]+)\.(png|jpg|webp)$/.exec(parts[1]);
      const file = m && join(LOGO_DIR, parts[1]);
      if (!file || !existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'content-type': IMAGE_MIME[m[2] as keyof typeof IMAGE_MIME],
        'x-content-type-options': 'nosniff',
        'cache-control': 'public, max-age=86400',
      });
      return res.end(readFileSync(file));
    }
    if (req.method === 'GET') {
      const file = PUBLIC_FILES[url.pathname];
      if (file) {
        res.writeHead(200, { 'content-type': file.type, 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' });
        return res.end(readFileSync(join(PUBLIC_DIR, file.name)));
      }
    }

    // GET /public/stations/:slug  what anyone may know about a station, plus live status
    if (req.method === 'GET' && parts[0] === 'public' && parts[1] === 'stations' && parts.length === 3) {
      const st = publicStation(parts[2]);
      if (!st) return send(res, 404, { error: 'No such station' });
      const mounts = await mountStatus();
      return send(res, 200, { ...st, on_air: mounts.has(st.slug), listeners: mounts.get(st.slug) ?? 0 }, { 'cache-control': 'no-store' });
    }

    // GET /s/:slug  the shareable station page
    if (req.method === 'GET' && parts[0] === 's' && parts.length === 2) {
      const st = publicStation(parts[1]);
      res.setHeader('content-security-policy',
        `default-src 'self'; img-src 'self' data:; media-src ${streamOrigin()}; connect-src 'self'; ` +
        "style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      if (!st) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Station not found</title><link rel="stylesheet" href="/public/station.css"><main class="wrap"><article class="card"><h1>Station not found</h1><p class="muted">Check the link, or <a href="/">start your own station</a>.</p></article></main>');
      }
      const summary = st.description || `${st.name}, live on VoxGarden${st.city || st.country ? ` from ${[st.city, st.country].filter(Boolean).join(', ')}` : ''}.`;
      const vars: Record<string, string> = {
        title: esc(`${st.name} · Live on VoxGarden`),
        name: esc(st.name),
        description: esc(summary),
        description_body: esc(st.description),
        page_url: esc(st.page),
        image_url: esc(st.logo ? PUBLIC_BASE + st.logo : `${PUBLIC_BASE}/public/default-logo.svg`),
        logo_src: esc(st.logo ?? '/public/default-logo.svg'),
        chips: [st.category, st.language, [st.city, st.country].filter(Boolean).join(', ')].filter(Boolean).map((c) => `<span>${esc(c)}</span>`).join(''),
        mb_per_hour: String(Math.round((st.bitrate * 1000 / 8) * 3600 / 1e6)),
        // Inside <script type="application/json">: escape "<" so the text can't close the tag.
        json: JSON.stringify(st).replace(/</g, '\\u003c'),
      };
      const html = readFileSync(join(PUBLIC_DIR, 'station.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/meta/options') {
      return send(res, 200, { categories: CATEGORIES, languages: LANGUAGES });
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
      return send(res, 200, myStations(user.id).map(presentStation));
    }

    if (req.method === 'POST' && url.pathname === '/stations') {
      const input = await readJson(req);
      const { name, slug } = input;
      if (typeof name !== 'string' || !name.trim() || name.length > 80) return send(res, 400, { error: 'Station name is required (max 80 characters)' });
      if (typeof slug !== 'string' || !SLUG.test(slug) || slug.length > 40) return send(res, 400, { error: 'Web address can use lowercase letters, numbers and hyphens' });
      const checked = validateDetails(input, false);
      if ('error' in checked) return send(res, 400, checked);
      const d = checked.values as Details;
      let id: number;
      try {
        db.exec('BEGIN');
        const r = db.prepare('INSERT INTO stations (slug, name, description, category, language, country, city, harbor_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(slug, name.trim(), d.description, d.category, d.language, d.country ?? '', d.city ?? '', randomBytes(18).toString('base64url'));
        id = Number(r.lastInsertRowid);
        db.prepare("INSERT INTO station_members (station_id, user_id, role) VALUES (?, ?, 'owner')").run(id, user.id);
        db.exec('COMMIT');
      } catch {
        db.exec('ROLLBACK');
        return send(res, 409, { error: 'That web address is taken. Try another.' });
      }
      mediaDir(slug); // the station's process starts with its first upload
      return send(res, 201, presentStation({ ...getStation(id), role: 'owner' }));
    }

    // PATCH /stations/:slug  edit profile (owners only). The web address is permanent.
    if (req.method === 'PATCH' && parts[0] === 'stations' && parts.length === 2) {
      const st = stationFor(user, parts[1]);
      if (!st) return send(res, 404, { error: 'No such station' });
      if (st.role !== 'owner') return send(res, 403, { error: 'Only the station owner can change its details' });
      const input = await readJson(req);
      const sets: string[] = [];
      const vals: (string | number)[] = [];
      if (input.name !== undefined) {
        if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) return send(res, 400, { error: 'Station name is required (max 80 characters)' });
        sets.push('name = ?');
        vals.push(input.name.trim());
      }
      const checked = validateDetails(input, true);
      if ('error' in checked) return send(res, 400, checked);
      for (const [k, v] of Object.entries(checked.values)) {
        sets.push(`${k} = ?`); // k comes from the fixed Details keys, never from the client
        vals.push(v as string);
      }
      if (sets.length) db.prepare(`UPDATE stations SET ${sets.join(', ')} WHERE id = ?`).run(...vals, st.id);
      // The stream carries the station name, so restart this station's process only.
      if (input.name !== undefined && hasMedia(st.id)) await ensureRunning(engineStation(st.id));
      return send(res, 200, presentStation({ ...getStation(st.id), role: st.role }));
    }

    // POST /stations/:slug/logo  (raw PNG/JPEG/WebP body, owners only)
    if (req.method === 'POST' && parts[0] === 'stations' && parts[2] === 'logo' && parts.length === 3) {
      const st = stationFor(user, parts[1]);
      if (!st) return send(res, 404, { error: 'No such station' });
      if (st.role !== 'owner') return send(res, 403, { error: 'Only the station owner can change the logo' });
      const body = await readBody(req, MAX_LOGO);
      const type = imageType(body);
      if (!type) return send(res, 400, { error: 'Logo must be a PNG, JPEG or WebP image' });
      for (const ext of ['png', 'jpg', 'webp']) rmSync(join(LOGO_DIR, `${st.slug}.${ext}`), { force: true });
      writeFileSync(join(LOGO_DIR, `${st.slug}.${type}`), body);
      db.prepare('UPDATE stations SET logo_file = ?, logo_version = logo_version + 1 WHERE id = ?').run(`${st.slug}.${type}`, st.id);
      return send(res, 200, presentStation({ ...getStation(st.id), role: st.role }));
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
          const r = db.prepare('INSERT INTO media (station_id, filename, bytes) VALUES (?, ?, ?)').run(st.id, saved, body.length);
          await ensureRunning(engineStation(st.id)); // no-op if already running
          return send(res, 201, { id: Number(r.lastInsertRowid), filename: saved, bytes: body.length });
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
        db.prepare("UPDATE schedule SET status = 'cancelled', error = 'Track removed from library' WHERE media_id = ? AND status = 'pending'").run(row.id);
        return send(res, 200, { ok: true });
      }
    }

    if (parts[0] === 'stations' && parts[2] === 'schedule') {
      const st = stationFor(user, parts[1] ?? '');
      if (!st) return send(res, 404, { error: 'No such station' });

      // GET /stations/:slug/schedule  upcoming items, then the 20 most recent past ones
      if (req.method === 'GET' && parts.length === 3) {
        const cols = 'id, media_id, filename, starts_at, status, sent_at, lateness_ms, error';
        const upcoming = db.prepare(`SELECT ${cols} FROM schedule WHERE station_id = ? AND status = 'pending' ORDER BY starts_at`).all(st.id);
        const past = db.prepare(`SELECT ${cols} FROM schedule WHERE station_id = ? AND status != 'pending' ORDER BY starts_at DESC LIMIT 20`).all(st.id);
        return send(res, 200, { upcoming, past, now: Date.now() });
      }

      // POST /stations/:slug/schedule  { media_id, starts_at }  starts_at: ms since epoch or ISO time
      if (req.method === 'POST' && parts.length === 3) {
        const { media_id, starts_at } = await readJson(req);
        const when = typeof starts_at === 'number' ? starts_at : typeof starts_at === 'string' ? Date.parse(starts_at) : NaN;
        if (!Number.isFinite(when)) return send(res, 400, { error: 'Choose a date and time' });
        if (when < Date.now() - 5_000) return send(res, 400, { error: 'That time has already passed' });
        if (when > Date.now() + 366 * 86_400_000) return send(res, 400, { error: 'You can schedule up to a year ahead' });
        const m = db.prepare('SELECT id, filename FROM media WHERE id = ? AND station_id = ?').get(Number(media_id), st.id) as { id: number; filename: string } | undefined;
        if (!m) return send(res, 400, { error: 'Choose a track from this station\'s library' });
        const r = db.prepare('INSERT INTO schedule (station_id, media_id, filename, starts_at, created_by) VALUES (?, ?, ?, ?, ?)')
          .run(st.id, m.id, m.filename, Math.round(when), user.id);
        return send(res, 201, { id: Number(r.lastInsertRowid), media_id: m.id, filename: m.filename, starts_at: Math.round(when), status: 'pending' });
      }

      // DELETE /stations/:slug/schedule/:id  cancel an item that hasn't played yet
      if (req.method === 'DELETE' && parts.length === 4) {
        const r = db.prepare("UPDATE schedule SET status = 'cancelled' WHERE id = ? AND station_id = ? AND status = 'pending'").run(Number(parts[3]), st.id);
        if (!r.changes) return send(res, 404, { error: 'Nothing to cancel: it has already played or does not exist' });
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

// ---- scheduler: hands due items to the station's engine ----
// Items more than a minute late (e.g. the platform was down) are marked missed
// rather than played at the wrong time.
const MISSED_AFTER_MS = 60_000;
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const due = db.prepare(
      `SELECT sc.id, sc.station_id, sc.filename, sc.starts_at, s.slug FROM schedule sc
       JOIN stations s ON s.id = sc.station_id WHERE sc.status = 'pending' AND sc.starts_at <= ? ORDER BY sc.starts_at`,
    ).all(Date.now()) as { id: number; station_id: number; filename: string; starts_at: number; slug: string }[];
    // Items due in the same tick for one station play back to back: only the first cuts in.
    const startedThisTick = new Set<number>();
    for (const item of due) {
      const now = Date.now();
      if (now - item.starts_at > MISSED_AFTER_MS) {
        db.prepare("UPDATE schedule SET status = 'missed', error = 'The platform was not running at the scheduled time' WHERE id = ?").run(item.id);
        continue;
      }
      try {
        const rid = await playNow({ id: item.station_id, slug: item.slug }, item.filename, !startedThisTick.has(item.station_id));
        startedThisTick.add(item.station_id);
        const sentAt = Date.now();
        db.prepare("UPDATE schedule SET status = 'sent', sent_at = ?, lateness_ms = ?, rid = ? WHERE id = ?")
          .run(sentAt, sentAt - item.starts_at, rid, item.id);
      } catch (e) {
        db.prepare("UPDATE schedule SET status = 'failed', error = ? WHERE id = ?").run((e as Error).message.slice(0, 200), item.id);
      }
    }
  } finally {
    ticking = false;
  }
}
setInterval(tick, 250);

// Boot: start every station that has audio, remove processes for deleted stations.
reconcile(stationsOnAir(), (db.prepare('SELECT slug FROM stations').all() as { slug: string }[]).map((r) => r.slug))
  .catch((e) => console.warn('engine reconcile failed:', (e as Error).message));
server.listen(PORT, '127.0.0.1', () => console.log(`control platform on http://127.0.0.1:${PORT}`));
