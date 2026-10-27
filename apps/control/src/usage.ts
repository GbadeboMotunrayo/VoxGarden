// Usage metering (FR-13): what each station costs to run, per day.
// Listener time is sampled from Icecast; uploads and processing are counted as they happen.
// These numbers exist to set prices and free-tier limits, so they favour being
// simple and explainable over being exact (see docs/USAGE.md for accuracy).
import type { DatabaseSync } from 'node:sqlite';

export function migrateUsage(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS usage_daily (
    station_id INTEGER NOT NULL REFERENCES stations(id),
    day TEXT NOT NULL,                          -- UTC date, YYYY-MM-DD
    listener_seconds REAL NOT NULL DEFAULT 0,   -- sum over listeners of time connected
    peak_listeners INTEGER NOT NULL DEFAULT 0,
    on_air_seconds REAL NOT NULL DEFAULT 0,     -- time the station's stream was up
    upload_bytes INTEGER NOT NULL DEFAULT 0,    -- audio received (uploads + recordings)
    processed_seconds REAL NOT NULL DEFAULT 0,  -- recording audio trimmed/converted
    conversions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (station_id, day)
  )`);
}

const today = () => new Date().toISOString().slice(0, 10);

type Counter = 'listener_seconds' | 'on_air_seconds' | 'upload_bytes' | 'processed_seconds' | 'conversions';

export function addUsage(db: DatabaseSync, stationId: number, add: Partial<Record<Counter, number>>, peak = 0): void {
  const v = { listener_seconds: 0, on_air_seconds: 0, upload_bytes: 0, processed_seconds: 0, conversions: 0, ...add };
  db.prepare(`INSERT INTO usage_daily (station_id, day, listener_seconds, peak_listeners, on_air_seconds, upload_bytes, processed_seconds, conversions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (station_id, day) DO UPDATE SET
      listener_seconds = listener_seconds + excluded.listener_seconds,
      peak_listeners = MAX(peak_listeners, excluded.peak_listeners),
      on_air_seconds = on_air_seconds + excluded.on_air_seconds,
      upload_bytes = upload_bytes + excluded.upload_bytes,
      processed_seconds = processed_seconds + excluded.processed_seconds,
      conversions = conversions + excluded.conversions`)
    .run(stationId, today(), v.listener_seconds, peak, v.on_air_seconds, v.upload_bytes, v.processed_seconds, v.conversions);
}

// Every `intervalMs`, credits each live station with (listeners × elapsed time).
// If the platform was down, the gap is not counted: elapsed is capped at 2 intervals.
export function startListenerSampler(
  db: DatabaseSync,
  mounts: () => Promise<Map<string, number>>,
  intervalMs = 30_000,
): () => void {
  let last = Date.now();
  const timer = setInterval(async () => {
    const now = Date.now();
    const dt = Math.min(now - last, intervalMs * 2) / 1000;
    last = now;
    const live = await mounts();
    if (!live.size) return;
    const ids = new Map((db.prepare('SELECT id, slug FROM stations').all() as { id: number; slug: string }[]).map((r) => [r.slug, r.id]));
    for (const [slug, listeners] of live) {
      const id = ids.get(slug);
      if (id !== undefined) addUsage(db, id, { listener_seconds: listeners * dt, on_air_seconds: dt }, listeners);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

export function storageBytes(db: DatabaseSync, stationId: number): number {
  return Number((db.prepare('SELECT COALESCE(SUM(bytes), 0) AS b FROM media WHERE station_id = ?').get(stationId) as { b: number }).b);
}

const since = (days: number) => new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
// Streamed data is estimated from listener time × the station's bitrate.
const streamedBytes = (listenerSeconds: number, kbps: number) => Math.round(listenerSeconds * kbps * 125);

export function stationUsage(db: DatabaseSync, stationId: number, bitrate: number, days: number) {
  const rows = db.prepare(`SELECT day, listener_seconds, peak_listeners, on_air_seconds, upload_bytes, processed_seconds, conversions
    FROM usage_daily WHERE station_id = ? AND day >= ? ORDER BY day`).all(stationId, since(days)) as {
      day: string; listener_seconds: number; peak_listeners: number; on_air_seconds: number;
      upload_bytes: number; processed_seconds: number; conversions: number }[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  // Fill empty days so charts have one bar per day.
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return { day, listener_hours: round((r?.listener_seconds ?? 0) / 3600, 2), peak_listeners: r?.peak_listeners ?? 0 };
  });
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + Number(r[k]), 0);
  const listenerSeconds = sum('listener_seconds');
  return {
    days,
    listener_hours: round(listenerSeconds / 3600, 2),
    peak_listeners: Math.max(0, ...rows.map((r) => r.peak_listeners)),
    on_air_hours: round(sum('on_air_seconds') / 3600, 1),
    streamed_bytes: streamedBytes(listenerSeconds, bitrate),
    upload_bytes: sum('upload_bytes'),
    processed_minutes: round(sum('processed_seconds') / 60, 1),
    conversions: sum('conversions'),
    storage_bytes: storageBytes(db, stationId),
    daily,
  };
}

// Founders' view: every station, heaviest listening first.
export function platformUsage(db: DatabaseSync, days: number) {
  const stations = db.prepare(`SELECT s.id, s.slug, s.name, s.bitrate,
      (SELECT u.email FROM station_members m JOIN users u ON u.id = m.user_id WHERE m.station_id = s.id AND m.role = 'owner' LIMIT 1) AS owner
    FROM stations s ORDER BY s.id`).all() as { id: number; slug: string; name: string; bitrate: number; owner: string | null }[];
  const rows = stations.map((s) => {
    const u = stationUsage(db, s.id, s.bitrate, days);
    const { daily: _d, days: _n, ...totals } = u;
    return { slug: s.slug, name: s.name, owner: s.owner, ...totals };
  }).sort((a, b) => b.listener_hours - a.listener_hours || b.storage_bytes - a.storage_bytes);
  const total = (k: 'listener_hours' | 'streamed_bytes' | 'upload_bytes' | 'storage_bytes' | 'processed_minutes') =>
    round(rows.reduce((a, r) => a + r[k], 0), 2);
  return {
    days,
    stations: rows,
    totals: {
      stations: rows.length,
      listener_hours: total('listener_hours'),
      streamed_bytes: total('streamed_bytes'),
      upload_bytes: total('upload_bytes'),
      storage_bytes: total('storage_bytes'),
      processed_minutes: total('processed_minutes'),
    },
  };
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
