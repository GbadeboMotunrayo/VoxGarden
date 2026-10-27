// Pushes a file into the schedule queue over telnet and measures the gap between
// the push and Liquidsoap's own "on air" timestamp for that request (ONAIR log line).
// Usage: node sched-latency.mjs [runs] [composeDir]
import net from 'node:net';
import { execFileSync } from 'node:child_process';

const runs = Number(process.argv[2] ?? 5);
const dir = process.argv[3] ?? '.';

const send = (cmd) => new Promise((ok, fail) => {
  const s = net.connect(1235, '127.0.0.1');
  let buf = '';
  let done = false;
  s.on('data', (d) => {
    buf += d;
    if (!done && buf.includes('\nEND')) { done = true; s.end(); ok(buf.split('\nEND')[0].trim()); }
  });
  s.on('error', fail);
  s.write(cmd + '\n');
});

const onAirTime = (rid) => {
  const logs = execFileSync('docker', ['compose', 'logs', 'liquidsoap', '--since', '60s'], { cwd: dir, encoding: 'utf8' });
  const m = new RegExp(`ONAIR rid=${rid} t=([0-9.]+)`).exec(logs);
  return m ? Number(m[1]) * 1000 : null;
};

const results = [];
for (let i = 0; i < runs; i++) {
  const pushedAt = Date.now();
  const rid = (await send('sched.push /media/sched/sched-1000.mp3')).split('\n').pop();
  await new Promise((r) => setTimeout(r, 3000));
  const t = onAirTime(rid);
  const ms = t === null ? null : t - pushedAt;
  results.push(ms);
  console.log(`run ${i + 1}: rid ${rid} on air after ${ms === null ? 'NOT SEEN' : ms.toFixed(0) + ' ms'}`);
  await send('sched.skip');
  await new Promise((r) => setTimeout(r, 2000));
}
const ok = results.filter((r) => r !== null).sort((a, b) => a - b);
console.log(JSON.stringify({ runs, seen: ok.length, min_ms: Math.round(ok[0]), median_ms: Math.round(ok[Math.floor(ok.length / 2)]), max_ms: Math.round(ok.at(-1)) }));
