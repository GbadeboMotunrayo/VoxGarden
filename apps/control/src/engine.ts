// Engine adapter: the only code that knows about Liquidsoap and Icecast.
// Everything else calls these functions, so the engine can be swapped later.
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ENGINE_DIR = resolve(import.meta.dirname, '../../../engine');
const MEDIA_DIR = join(ENGINE_DIR, 'media');
const GENERATED_DIR = join(ENGINE_DIR, 'generated');

export interface EngineStation {
  slug: string;
  name: string;
  bitrate: number;
}

export function mediaDir(slug: string): string {
  const dir = join(MEDIA_DIR, slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Liquidsoap strings: keep user text out of code by escaping.
const q = (s: string) => JSON.stringify(s);

export function renderConfig(stations: EngineStation[]): string {
  const head = `settings.log.stdout := true
settings.log.level := 3
pw = environment.get("ICECAST_SOURCE_PASSWORD")
`;
  const blocks = stations.map((s) => `
# --- station: ${s.slug} ---
${s.slug.replace(/-/g, '_')} = playlist(mode="randomize", reload_mode="watch", ${q('/media/' + s.slug)})
${s.slug.replace(/-/g, '_')} = mksafe(${s.slug.replace(/-/g, '_')})
output.icecast(%mp3(bitrate=${s.bitrate}), host="icecast", port=8000, password=pw,
  mount=${q('/' + s.slug)}, name=${q(s.name)}, description="VoxGarden station",
  ${s.slug.replace(/-/g, '_')})
`);
  return head + blocks.join('');
}

export function writeConfig(stations: EngineStation[]): void {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(join(GENERATED_DIR, 'main.liq'), renderConfig(stations));
}

// Dev-only: apply by restarting the playout container. Production will run one
// process per station so adding a station never interrupts the others.
export function reload(): Promise<void> {
  return new Promise((ok) => {
    execFile('docker', ['compose', '-f', join(ENGINE_DIR, 'docker-compose.yml'), 'restart', 'liquidsoap'],
      { env: { ...process.env } }, (err) => {
        if (err) console.warn('engine reload failed (is the engine running?):', err.message);
        ok();
      });
  });
}

export function importTrack(slug: string, srcPath: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = join(mediaDir(slug), safe);
  copyFileSync(srcPath, dest);
  return safe;
}

export function removeTrack(slug: string, filename: string): void {
  rmSync(join(mediaDir(slug), filename), { force: true });
}

export function listenUrl(slug: string): string {
  return `http://localhost:8000/${slug}`;
}
