// npm run demo — fills a running VoxGarden with clearly-labelled demo stations,
// so the landing page, Explore and station pages have something to show.
// Each station gets a generated logo and a generated music bed (no copyrighted audio).
// Safe to run again: existing demo stations are left as they are.
// The demo login is saved to data/demo-login.txt (git-ignored) and printed once.
import { randomBytes } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.VG_BASE ?? 'http://localhost:4000';
const ROOT = resolve(import.meta.dirname, '..');
const LOGIN_FILE = resolve(ROOT, 'data/demo-login.txt');

// Fictional stations: no real institutions or people.
const STATIONS = [
  { slug: 'oro-aaro-fm', name: 'Ọ̀rọ̀ Àárọ̀ FM', category: 'Culture & Language', language: 'Yoruba', city: 'Abẹ́òkúta', country: 'Nigeria',
    description: 'Morning talk, proverbs and highlife in Yoruba.', colors: ['#1f4b37', '#e9a04b'], key: 57, bpm: 96 },
  { slug: 'lagoon-campus-radio', name: 'Lagoon Campus Radio', category: 'Campus', language: 'English', city: 'Lagos', country: 'Nigeria',
    description: 'Student news, debates and late-night music from the lagoon side of campus.', colors: ['#14343f', '#f2c14e'], key: 60, bpm: 112 },
  { slug: 'kasuwa-report', name: 'Kasuwa Report', category: 'Business', language: 'Hausa', city: 'Kano', country: 'Nigeria',
    description: 'Prices, trade news and market interviews, in Hausa.', colors: ['#5b2a1a', '#e8b07a'], key: 55, bpm: 90 },
  { slug: 'nne-kitchen-table', name: 'Nne’s Kitchen Table', category: 'Community', language: 'Igbo', city: 'Enugu', country: 'Nigeria',
    description: 'Family, food and community stories in Igbo.', colors: ['#3d2a52', '#f0a35e'], key: 62, bpm: 84 },
  { slug: 'pitch-side-pidgin', name: 'Pitch Side Pidgin', category: 'Sports', language: 'Nigerian Pidgin', city: 'Port Harcourt', country: 'Nigeria',
    description: 'Football talk, match previews and fan calls, for Pidgin speakers.', colors: ['#7a1f1a', '#f5d06f'], key: 64, bpm: 124 },
  { slug: 'accra-after-dark', name: 'Accra After Dark', category: 'Music', language: 'English', city: 'Accra', country: 'Ghana',
    description: 'Highlife, Afrobeats and quiet-storm conversation after 10pm.', colors: ['#10221c', '#d98a3a'], key: 53, bpm: 100 },
];

// ---------- HTTP with a session cookie ----------
let cookie = '';
async function call(path, { method = 'GET', body, type } = {}) {
  const res = await fetch(BASE + path, {
    method, body,
    headers: { 'x-vg-request': '1', ...(cookie ? { cookie } : {}), ...(type ? { 'content-type': type } : {}) },
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json };
}

// ---------- generated logo: a PNG made from scratch ----------
function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) pixel(x, y).forEach((v, i) => { raw[y * (size * 4 + 1) + 1 + x * 4 + i] = v; });
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// A sun rising over equaliser bars, in the station's two colours.
function logo([bgc, fgc], seed) {
  const S = 256, bg = hex(bgc), fg = hex(fgc), paper = [251, 248, 242];
  const bars = Array.from({ length: 9 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(seed * 1.7 + i * 1.3)));
  return png(S, (x, y) => {
    const cx = S * 0.5, cy = S * 0.58, r = S * 0.27;
    const inSun = (x - cx) ** 2 + (y - cy) ** 2 < r * r && y < cy;
    const bi = Math.floor((x - S * 0.14) / (S * 0.08));
    // Bars rise from a baseline, like a level meter.
    const inBar = bi >= 0 && bi < 9 && (x - S * 0.14) % (S * 0.08) < S * 0.05 && y < S * 0.86 && y > S * 0.86 - bars[bi] * S * 0.24;
    return [...(inBar ? paper : inSun ? fg : bg), 255];
  });
}

// ---------- generated music bed: soft chords with a gentle pulse (60 s, WAV) ----------
function bed(rootMidi, bpm, seconds = 60, rate = 22050) {
  const n = seconds * rate, buf = Buffer.alloc(44 + n * 2), v = new DataView(buf.buffer);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  const f = (m) => 440 * 2 ** ((m - 69) / 12);
  const prog = [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]]; // I maj7, IV, vi, V
  const beat = 60 / bpm, bar = beat * 4;
  for (let i = 0; i < n; i++) {
    const t = i / rate, chord = prog[Math.floor(t / bar) % 4], inBar = (t % bar) / bar;
    let s = 0;
    for (const iv of chord) { const fr = f(rootMidi + iv); s += 0.12 * Math.sin(2 * Math.PI * fr * t) + 0.04 * Math.sin(4 * Math.PI * fr * t); }
    s *= 0.6 + 0.4 * Math.min(1, inBar * 8) * (1 - inBar * 0.3);
    const tb = t % beat; s += 0.35 * Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9); // soft kick
    const fade = Math.min(1, t / 2, (seconds - t) / 2);
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * 0.7 * fade)) * 32767, true);
  }
  return buf;
}

// ---------- main ----------
async function signIn() {
  if (existsSync(LOGIN_FILE)) {
    const [email, password] = readFileSync(LOGIN_FILE, 'utf8').trim().split('\n').map((l) => l.split(': ')[1]);
    const r = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.status === 200) return { email, password, fresh: false };
  }
  const email = 'demo@voxgarden.local';
  const password = `demo-${randomBytes(9).toString('base64url')}`;
  const r = await call('/auth/signup', { method: 'POST', body: JSON.stringify({ email, name: 'VoxGarden Demo', password }) });
  if (r.status !== 201) throw new Error(`Could not create the demo account (${r.status}: ${r.json.error ?? ''}). If it exists from before, delete data/demo-login.txt only together with the database.`);
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  writeFileSync(LOGIN_FILE, `email: ${email}\npassword: ${password}\n`, { mode: 0o600 });
  return { email, password, fresh: true };
}

try {
  await call('/health');
} catch {
  console.error(`VoxGarden is not running at ${BASE}. Start it with "npm start" in another terminal, then run "npm run demo".`);
  process.exit(1);
}

const login = await signIn();
const mine = (await call('/stations')).json;
const have = new Set(Array.isArray(mine) ? mine.map((s) => s.slug) : []);
let made = 0;
for (const [i, s] of STATIONS.entries()) {
  if (have.has(s.slug)) {
    // DEMO_REFRESH=1 npm run demo redraws the logos of existing demo stations.
    if (process.env.DEMO_REFRESH) await call(`/stations/${s.slug}/logo`, { method: 'POST', body: logo(s.colors, i + 1), type: 'image/png' });
    console.log(`  ✓ ${s.name} (already there${process.env.DEMO_REFRESH ? ', logo redrawn' : ''})`);
    continue;
  }
  const created = await call('/stations', { method: 'POST', body: JSON.stringify({
    name: s.name, slug: s.slug, category: s.category, language: s.language, city: s.city, country: s.country,
    description: `${s.description} Demo station.`,
  }) });
  if (created.status !== 201) { console.log(`  ✗ ${s.name}: ${created.json.error}`); continue; }
  await call(`/stations/${s.slug}/logo`, { method: 'POST', body: logo(s.colors, i + 1), type: 'image/png' });
  const up = await call(`/stations/${s.slug}/recordings?${new URLSearchParams({ title: `${s.name} theme`, start: '0', end: '60' })}`,
    { method: 'POST', body: bed(s.key, s.bpm), type: 'audio/wav' });
  console.log(up.status === 201 ? `  ✓ ${s.name}` : `  ✗ ${s.name}: audio failed (${up.json.error})`);
  made++;
  // Stations start one at a time: each engine briefly needs ~300 MB while starting.
  await new Promise((r) => setTimeout(r, 5000));
}

console.log(`\n${made ? `Created ${made} demo station(s).` : 'Demo stations are already in place.'}`);
console.log(`Open ${BASE} and ${BASE}/explore`);
console.log(`Studio login (also in data/demo-login.txt): ${login.email} / ${login.password}`);
