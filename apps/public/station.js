// Public station page: listen, see if the station is live, share it. No login.
// Built for phones on weak data: pausing stops the download, and a dropped
// stream reconnects on its own while the listener still wants to hear it.
const $ = (id) => document.getElementById(id);
const station = JSON.parse($('station-data').textContent);
const audio = $('audio');
const play = $('play');
let wantPlaying = false;
let retry = 0;
let retryTimer = null;
let onAir = false;

function setState(state, text, live = false) {
  play.dataset.state = state;
  play.setAttribute('aria-label', `${state === 'playing' ? 'Pause' : 'Play'} ${station.name}`);
  $('status').textContent = text;
  $('status').classList.toggle('live', live);
}

function start() {
  clearTimeout(retryTimer);
  wantPlaying = true;
  setState('loading', retry ? 'Reconnecting…' : 'Connecting…');
  // A fresh URL each time, so the browser never replays a stale buffered stream.
  audio.src = `${station.stream}?t=${Date.now()}`;
  audio.play().catch(() => {
    // Autoplay blocked or stream unreachable: the error handler decides what's next.
  });
}

function stop() {
  wantPlaying = false;
  retry = 0;
  clearTimeout(retryTimer);
  audio.pause();
  // Dropping the source stops the download, so a paused listener uses no data.
  audio.removeAttribute('src');
  audio.load();
  setState('idle', onAir ? 'Live now' : 'Off air', onAir);
}

function scheduleRetry() {
  if (!wantPlaying) return;
  retry++;
  const wait = Math.min(30, 2 ** retry); // 2, 4, 8, 16, 30, 30 … seconds
  setState('loading', `Connection lost. Retrying in ${wait} s…`);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(start, wait * 1000);
}

play.onclick = () => (wantPlaying ? stop() : start());
audio.addEventListener('playing', () => { retry = 0; setState('playing', 'Listening live', true); });
audio.addEventListener('waiting', () => { if (wantPlaying) setState('loading', 'Buffering…', true); });
audio.addEventListener('error', () => { if (wantPlaying) scheduleRetry(); });
audio.addEventListener('ended', () => { if (wantPlaying) scheduleRetry(); }); // a live stream only "ends" when it drops
$('volume').oninput = (e) => { audio.volume = Number(e.target.value); };

// Lock-screen and headset controls on phones.
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: station.name, artist: 'Live on VoxGarden',
    artwork: station.logo ? [{ src: station.logo, sizes: '512x512' }] : [],
  });
  navigator.mediaSession.setActionHandler('play', start);
  navigator.mediaSession.setActionHandler('pause', stop);
  navigator.mediaSession.setActionHandler('stop', stop);
}

// Is the station broadcasting, and how many people are listening?
async function refresh() {
  try {
    const res = await fetch(`/public/stations/${station.slug}`, { cache: 'no-store' });
    if (!res.ok) return;
    const s = await res.json();
    onAir = s.on_air;
    play.disabled = !onAir && !wantPlaying;
    $('listeners').textContent = onAir && s.listeners > 0 ? `${s.listeners} listening now` : '';
    if (!wantPlaying) setState('idle', s.presenter_live ? 'Live now: presenter on air' : onAir ? 'Live now' : 'Off air: this station hasn\'t started broadcasting yet', onAir);
  } catch {
    // Offline: keep showing the last known state.
  }
}
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 15_000);

// ---- sharing ----
const shareText = `Listen to ${station.name} on VoxGarden`;
$('wa').href = `https://wa.me/?text=${encodeURIComponent(`${shareText}: ${station.page}`)}`;
if (navigator.share) {
  $('share').onclick = () => navigator.share({ title: station.name, text: shareText, url: station.page }).catch(() => {});
} else {
  $('share').hidden = true;
}
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(station.page); } catch { return; }
  $('copied').hidden = false;
  setTimeout(() => { $('copied').hidden = true; }, 1800);
};
