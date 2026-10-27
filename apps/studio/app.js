// VoxGarden Studio v0. Plain JS, no build step. All text goes through textContent.
const $ = (id) => document.getElementById(id);
let stations = [];
let current = null;

// Every request carries x-vg-request (the server's CSRF check). A 401 means the
// session is gone, so we fall back to the sign-in screen.
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'x-vg-request': '1', ...(opts.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/auth/')) showAuth();
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// ---- sign up / log in ----
let mode = 'signup';
function setMode(m) {
  mode = m;
  const signup = m === 'signup';
  $('auth-title').textContent = signup ? 'Start your station' : 'Welcome back';
  $('auth-sub').textContent = signup ? 'Create a free account. No technical setup.' : 'Log in to manage your stations.';
  $('f-name').hidden = !signup;
  $('a-name').required = signup;
  $('pass-hint').hidden = !signup;
  $('a-pass').autocomplete = signup ? 'new-password' : 'current-password';
  $('auth-submit').textContent = signup ? 'Create account' : 'Log in';
  $('switch-text').textContent = signup ? 'Already have an account?' : 'New to VoxGarden?';
  $('auth-switch').textContent = signup ? 'Log in' : 'Create an account';
  $('a-err').hidden = true;
}
$('auth-switch').onclick = () => setMode(mode === 'signup' ? 'login' : 'signup');

function showAuth() {
  current = null;
  $('app').hidden = true;
  $('auth').hidden = false;
  $('who').hidden = true;
  $('logout').hidden = true;
  $('admin-btn').hidden = true;
  $('admin').hidden = true;
  $('conn').hidden = true;
}

function showApp(user) {
  $('auth').hidden = true;
  $('app').hidden = false;
  $('who').textContent = user.name;
  $('who').hidden = false;
  $('logout').hidden = false;
  $('conn').hidden = false;
  loadStations();
  // Founders get the platform-wide usage view.
  api('/auth/me').then(({ admin }) => { $('admin-btn').hidden = !admin; }).catch(() => {});
}

$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('auth-submit');
  btn.disabled = true;
  $('a-err').hidden = true;
  try {
    const payload = { email: $('a-email').value, password: $('a-pass').value };
    if (mode === 'signup') payload.name = $('a-name').value;
    const { user } = await api(mode === 'signup' ? '/auth/signup' : '/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    $('auth-form').reset();
    showApp(user);
  } catch (ex) {
    $('a-err').textContent = ex.message;
    $('a-err').hidden = false;
  } finally {
    btn.disabled = false;
  }
};

$('logout').onclick = async () => {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  $('stations').replaceChildren();
  $('station').hidden = true;
  $('audio').pause();
  setMode('login');
  showAuth();
};

const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  kids.forEach((k) => n.append(k));
  return n;
}

async function loadStations(selectSlug) {
  try {
    stations = await api('/stations');
    $('conn').textContent = 'Engine connected';
    $('conn').className = 'conn ok';
  } catch {
    $('conn').textContent = 'Cannot reach the control platform';
    $('conn').className = 'conn bad';
    return;
  }
  const list = $('stations');
  list.replaceChildren(...stations.map((s) => {
    const b = el('button', { type: 'button' }, s.name, el('small', {}, '/' + s.slug));
    b.setAttribute('aria-current', String(current === s.slug));
    b.onclick = () => select(s.slug);
    return el('li', {}, b);
  }));
  if (selectSlug) select(selectSlug);
  else if (current && stations.some((s) => s.slug === current)) select(current);
  else if (stations.length && !current) select(stations[0].slug);
  $('empty').hidden = stations.length > 0;
}

async function select(slug) {
  const s = stations.find((x) => x.slug === slug);
  if (!s) return;
  const changed = current !== slug;
  current = slug;
  document.querySelectorAll('#stations button').forEach((b, i) => b.setAttribute('aria-current', String(stations[i].slug === slug)));
  $('empty').hidden = true;
  $('admin').hidden = true;
  $('station').hidden = false;
  renderStationHead(s);
  // A recording waiting to be sent goes to whichever station is selected.
  if (!$('rec-review').hidden && !$('rec-send').disabled) $('rec-send').textContent = `Send to ${s.name}`;
  const url = s.listen; // served through the platform, so it works over HTTPS too
  // Share the public station page, not the raw stream: it works in any browser and previews in WhatsApp.
  const page = `${location.origin}/s/${s.slug}`;
  $('st-url').textContent = page;
  $('public-link').href = page;
  if (changed) {
    const a = $('audio');
    a.pause();
    a.src = url;
    a.load();
  }
  await loadTracks();
}

async function loadTracks() {
  const tracks = await api(`/stations/${current}/media`);
  $('count').textContent = tracks.length ? `(${tracks.length})` : '';
  $('no-tracks').hidden = tracks.length > 0;
  $('st-badge').textContent = tracks.length ? 'On air' : 'Waiting for audio';
  $('st-badge').classList.toggle('off', !tracks.length);
  $('tracks').replaceChildren(...tracks.map((t) => {
    const del = el('button', { className: 'btn small danger', type: 'button' }, 'Remove');
    del.onclick = async () => {
      if (!confirm(`Remove "${t.filename}" from this station?`)) return;
      del.disabled = true;
      try { await api(`/stations/${current}/media/${t.id}`, { method: 'DELETE' }); } catch (e) { alert(e.message); }
      loadTracks();
    };
    return el('li', {}, el('span', { title: t.filename }, t.title || t.filename), el('span', { className: 'size' }, fmtSize(t.bytes), ' ', del));
  }));
  // Keep the schedule's track picker in step with the library.
  const pick = $('sched-track');
  const keep = pick.value;
  pick.replaceChildren(el('option', { value: '', textContent: tracks.length ? 'Choose a track…' : 'Upload a track first' }),
    ...tracks.map((t) => el('option', { value: String(t.id), textContent: t.title || t.filename })));
  if (tracks.some((t) => String(t.id) === keep)) pick.value = keep;
  loadSchedule();
  loadUsage().catch(() => {});
}

// ---- schedule (FR-08) ----
$('tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
const fmtWhen = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
// datetime-local wants "YYYY-MM-DDTHH:MM" in local time.
const toLocalInput = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

function statusText(item) {
  if (item.status === 'sent') return item.lateness_ms <= 10_000 ? 'Played on time' : `Played ${Math.round(item.lateness_ms / 1000)} s late`;
  return { missed: 'Missed', failed: 'Failed', cancelled: 'Cancelled' }[item.status] ?? item.status;
}

async function loadSchedule() {
  if (!current) return;
  const slug = current;
  const { upcoming, past } = await api(`/stations/${slug}/schedule`);
  if (slug !== current) return; // user switched station while this loaded
  $('sched-none').hidden = upcoming.length > 0;
  $('sched-nopast').hidden = past.length > 0;
  $('sched-upcoming').replaceChildren(...upcoming.map((i) => {
    const cancel = el('button', { className: 'btn small danger', type: 'button', textContent: 'Cancel' });
    cancel.onclick = async () => {
      cancel.disabled = true;
      try { await api(`/stations/${slug}/schedule/${i.id}`, { method: 'DELETE' }); } catch (e) { alert(e.message); }
      loadSchedule();
    };
    return el('li', {}, el('span', {}, el('span', { className: 'when', textContent: fmtWhen(i.starts_at) }), ' · ', i.filename), cancel);
  }));
  $('sched-past').replaceChildren(...past.map((i) => {
    const badge = el('span', { className: `status ${i.status}`, textContent: statusText(i) });
    if (i.error) badge.title = i.error;
    return el('li', {}, el('span', {}, el('span', { className: 'when', textContent: fmtWhen(i.starts_at) }), ' · ', i.filename), badge);
  }));
}

$('sched-form').onsubmit = async (e) => {
  e.preventDefault();
  const err = $('sched-err');
  err.hidden = true;
  const media_id = Number($('sched-track').value);
  const when = $('sched-when').value ? new Date($('sched-when').value).getTime() : NaN;
  if (!media_id) { err.textContent = 'Choose a track.'; err.hidden = false; return; }
  if (!Number.isFinite(when)) { err.textContent = 'Choose a date and time.'; err.hidden = false; return; }
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    await api(`/stations/${current}/schedule`, { method: 'POST', body: JSON.stringify({ media_id, starts_at: when }) });
    loadSchedule();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
};

// Default the picker to five minutes from now, and refresh statuses while open.
$('sched-when').value = toLocalInput(Date.now() + 5 * 60_000);
setInterval(() => { if (current && !$('app').hidden && !document.hidden) loadSchedule().catch(() => {}); }, 5000);

function renderStationHead(s) {
  $('st-name').textContent = s.name;
  $('st-desc').textContent = s.description || '';
  $('st-chips').replaceChildren(...[s.category, s.language, [s.city, s.country].filter(Boolean).join(', ')]
    .filter(Boolean).map((t) => el('span', {}, t)));
  $('st-logo').hidden = !s.logo;
  $('st-logo-ph').hidden = !!s.logo;
  if (s.logo) $('st-logo').src = s.logo;
  $('edit-station').hidden = s.role !== 'owner';
}

// ---- station wizard (FR-02): create and edit share the same four steps ----
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STEPS = ['Name your station', 'What is it about?', 'Where is it from?', 'Add a logo'];
const wz = { mode: 'create', step: 1, slug: null, logo: null, slugTouched: false, options: null };

async function loadOptions() {
  if (wz.options) return;
  wz.options = await api('/meta/options');
  for (const [id, list] of [['wz-category', wz.options.categories], ['wz-language', wz.options.languages]]) {
    $(id).append(...list.map((v) => el('option', { value: v, textContent: v })));
  }
}

async function openWizard(mode) {
  await loadOptions();
  const s = mode === 'edit' ? stations.find((x) => x.slug === current) : null;
  Object.assign(wz, { mode, step: 1, slug: s?.slug ?? null, logo: null, slugTouched: mode === 'edit' });
  $('wz-name').value = s?.name ?? '';
  $('wz-slug').value = s?.slug ?? '';
  $('wz-slug-wrap').hidden = mode === 'edit';
  $('wz-desc').value = s?.description ?? '';
  $('wz-category').value = s?.category ?? '';
  $('wz-language').value = s?.language ?? '';
  $('wz-country').value = s?.country ?? '';
  $('wz-city').value = s?.city ?? '';
  $('wz-logo').value = '';
  setLogoPreview(s?.logo ?? null);
  $('wz-desc-count').textContent = $('wz-desc').value.length;
  showStep();
  $('wizard').showModal();
  $('wz-name').focus();
}

function setLogoPreview(src) {
  $('wz-logo-preview').hidden = !src;
  $('wz-logo-ph').hidden = !!src;
  if (src) $('wz-logo-preview').src = src;
  $('wz-logo-btn').textContent = src ? 'Change image' : 'Choose image';
}

function showStep() {
  document.querySelectorAll('#wz-form fieldset').forEach((f) => { f.hidden = Number(f.dataset.step) !== wz.step; });
  document.querySelectorAll('.wz-dots li').forEach((d, i) => d.classList.toggle('on', i < wz.step));
  $('wz-step-label').textContent = `${wz.mode === 'edit' ? 'Edit station · ' : ''}Step ${wz.step} of 4`;
  $('wz-title').textContent = STEPS[wz.step - 1];
  $('wz-back').textContent = wz.step === 1 ? 'Cancel' : 'Back';
  $('wz-next').textContent = wz.step < 4 ? 'Next' : wz.mode === 'edit' ? 'Save changes' : 'Create station';
  $('wz-err').hidden = true;
  document.querySelectorAll('#wz-form [aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  if (wz.step === 4) renderReview();
}

function renderReview() {
  const rows = [
    ['Name', $('wz-name').value.trim()],
    ['Web address', '/' + (wz.slug ?? $('wz-slug').value)],
    ['Category', $('wz-category').value],
    ['Language', $('wz-language').value],
    ['Place', [$('wz-city').value.trim(), $('wz-country').value.trim()].filter(Boolean).join(', ') || 'Not set'],
  ];
  $('wz-review').replaceChildren(el('dl', {}, ...rows.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])));
}

function fail(msg, field) {
  $('wz-err').textContent = msg;
  $('wz-err').hidden = false;
  if (field) { $(field).setAttribute('aria-invalid', 'true'); $(field).focus(); }
  return false;
}

function stepValid() {
  if (wz.step === 1) {
    if (!$('wz-name').value.trim()) return fail('Give your station a name.', 'wz-name');
    if (wz.mode === 'create' && !SLUG_RE.test($('wz-slug').value)) return fail('Web address can use lowercase letters, numbers and hyphens.', 'wz-slug');
  }
  if (wz.step === 2) {
    if (!$('wz-category').value) return fail('Choose a category.', 'wz-category');
    if (!$('wz-language').value) return fail('Choose the main language.', 'wz-language');
  }
  return true;
}

$('wz-back').onclick = () => {
  if (wz.step === 1) return $('wizard').close();
  wz.step--;
  showStep();
};

$('wz-next').onclick = async () => {
  if (!stepValid()) return;
  if (wz.step < 4) { wz.step++; showStep(); return; }
  const btn = $('wz-next');
  btn.disabled = true;
  const details = {
    name: $('wz-name').value, description: $('wz-desc').value, category: $('wz-category').value,
    language: $('wz-language').value, country: $('wz-country').value, city: $('wz-city').value,
  };
  try {
    if (wz.mode === 'create') {
      const made = await api('/stations', { method: 'POST', body: JSON.stringify({ ...details, slug: $('wz-slug').value }) });
      // From here the station exists; a failed logo upload should retry as an edit, not a second create.
      Object.assign(wz, { mode: 'edit', slug: made.slug });
    } else {
      await api(`/stations/${wz.slug}`, { method: 'PATCH', body: JSON.stringify(details) });
    }
    if (wz.logo) {
      try {
        await api(`/stations/${wz.slug}/logo`, { method: 'POST', body: wz.logo });
        wz.logo = null;
      } catch (ex) {
        await loadStations(wz.slug);
        showStep();
        return fail(`Station saved, but the logo didn't upload: ${ex.message}`);
      }
    }
    $('wizard').close();
    await loadStations(wz.slug);
  } catch (ex) {
    if (/web address/i.test(ex.message)) { wz.step = 1; showStep(); return fail(ex.message, 'wz-slug'); }
    fail(ex.message);
  } finally {
    btn.disabled = false;
  }
};

// Enter moves forward instead of submitting the dialog form.
$('wz-form').onsubmit = (e) => { e.preventDefault(); $('wz-next').click(); };
$('wz-form').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); $('wz-next').click(); }
});

// Suggest a web address from the name until the user edits it themselves.
$('wz-slug').oninput = () => { wz.slugTouched = true; };
$('wz-name').oninput = () => {
  if (wz.slugTouched) return;
  // NFD splits "Ọ" into "O" + a combining dot, so tone marks drop and the letters stay.
  $('wz-slug').value = $('wz-name').value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
};
$('wz-desc').oninput = () => { $('wz-desc-count').textContent = $('wz-desc').value.length; };

$('wz-logo').onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return fail('Logo must be a PNG, JPEG or WebP image.');
  if (f.size > 2 * 1024 * 1024) return fail('Logo must be 2 MB or smaller.');
  $('wz-err').hidden = true;
  wz.logo = f;
  setLogoPreview(URL.createObjectURL(f));
};

$('new-station').onclick = () => openWizard('create');
$('empty-new').onclick = () => openWizard('create');
$('edit-station').onclick = () => openWizard('edit');

function upload(file) {
  const row = el('li', {}, el('span', {}, file.name), el('span', { className: 'size' }, 'Uploading…'));
  $('uploads').prepend(row);
  const status = row.lastChild;
  return fetch(`/stations/${current}/media?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST', body: file, headers: { 'x-vg-request': '1' },
  })
    .then(async (r) => {
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || 'Upload failed');
      row.remove();
    })
    .catch((e) => { status.textContent = e.message; });
}

async function handleFiles(files) {
  if (!current) return;
  for (const f of files) await upload(f);
  loadTracks();
}

const drop = $('drop');
drop.onclick = () => $('file').click();
drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
$('file').onchange = (e) => { handleFiles([...e.target.files]); e.target.value = ''; };
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('st-url').textContent); } catch { return; }
  $('copied').hidden = false;
  setTimeout(() => { $('copied').hidden = true; }, 1500);
};

// Boot: signed in already? Go straight to the stations.
api('/auth/me').then(({ user }) => showApp(user)).catch(() => { setMode('signup'); showAuth(); });

// ---- record a programme (FR-04) ----
// Records with the device microphone, lets the user trim the start and end, and
// sends the original recording plus the cut points; the server trims and converts.
const rec = { stream: null, recorder: null, chunks: [], mime: '', started: 0, elapsed: 0, timer: null,
  ctx: null, raf: null, blob: null, buffer: null, peaks: null, duration: 0, player: null };
// Above this length the waveform is skipped: decoding a long recording can exhaust a cheap phone's memory.
const MAX_DECODE_S = 20 * 60;
const fmtT = (s, tenths = false) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${tenths ? r.toFixed(1).padStart(4, '0') : String(Math.floor(r)).padStart(2, '0')}`;
};
const recView = (v) => ['idle', 'live', 'review'].forEach((n) => { $(`rec-${n}`).hidden = n !== v; });
const recNote = (msg) => { $('rec-unsupported').textContent = msg; $('rec-unsupported').hidden = !msg; };
const warnUnsent = (e) => { e.preventDefault(); e.returnValue = ''; };

function recSupportProblem() {
  if (!window.isSecureContext) return 'Recording needs a secure page (https:// or localhost). It will work on phones once VoxGarden runs on HTTPS.';
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return 'This browser cannot record audio. Try Chrome or Safari.';
  return null;
}
{
  const problem = recSupportProblem();
  if (problem) { recNote(problem); $('rec-start').disabled = true; }
}

const recSeconds = () => rec.elapsed + (rec.recorder?.state === 'recording' ? (performance.now() - rec.started) / 1000 : 0);
const updateClock = () => { $('rec-clock').textContent = fmtT(recSeconds()); };

$('rec-start').onclick = async () => {
  recNote('');
  try {
    rec.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    recNote(e.name === 'NotAllowedError'
      ? 'Microphone access was blocked. Allow it from the icon next to the address bar, then try again.'
      : 'No microphone was found on this device.');
    return;
  }
  // Opus in WebM (Chrome, Android), Ogg (Firefox), AAC in MP4 (Safari, iPhone): all small enough for mobile data.
  rec.mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  rec.recorder = new MediaRecorder(rec.stream, rec.mime ? { mimeType: rec.mime, audioBitsPerSecond: 48000 } : undefined);
  rec.chunks = [];
  rec.recorder.ondataavailable = (e) => { if (e.data.size) rec.chunks.push(e.data); };
  rec.recorder.onstop = finishRecording;
  rec.recorder.start(1000);
  rec.elapsed = 0;
  rec.started = performance.now();

  // Level meter, so people can see the mic is picking them up.
  rec.ctx = new AudioContext();
  const analyser = rec.ctx.createAnalyser();
  analyser.fftSize = 512;
  rec.ctx.createMediaStreamSource(rec.stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const draw = () => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
    $('rec-level').style.width = `${Math.min(100, (peak / 128) * 140)}%`;
    rec.raf = requestAnimationFrame(draw);
  };
  draw();
  rec.timer = setInterval(updateClock, 250);
  updateClock();
  $('rec-card').classList.remove('paused');
  $('rec-pause').textContent = 'Pause';
  $('rec-state').textContent = 'Recording';
  recView('live');
  window.addEventListener('beforeunload', warnUnsent);
};

$('rec-pause').onclick = () => {
  if (rec.recorder.state === 'recording') {
    rec.elapsed = recSeconds();
    rec.recorder.pause();
    $('rec-pause').textContent = 'Resume';
    $('rec-state').textContent = 'Paused';
    $('rec-card').classList.add('paused');
  } else {
    rec.started = performance.now();
    rec.recorder.resume();
    $('rec-pause').textContent = 'Pause';
    $('rec-state').textContent = 'Recording';
    $('rec-card').classList.remove('paused');
  }
};

$('rec-stop').onclick = () => {
  rec.elapsed = recSeconds();
  rec.recorder.stop();
};

function releaseMic() {
  clearInterval(rec.timer);
  cancelAnimationFrame(rec.raf);
  rec.stream?.getTracks().forEach((t) => t.stop());
  rec.ctx?.close();
  rec.ctx = null;
}

async function finishRecording() {
  releaseMic();
  rec.blob = new Blob(rec.chunks, { type: rec.recorder.mimeType || rec.mime || 'audio/webm' });
  rec.chunks = [];
  rec.duration = rec.elapsed;
  rec.buffer = null;
  rec.peaks = null;
  if (rec.duration <= MAX_DECODE_S) {
    try {
      // Decoded at 16 kHz mono: enough for a waveform and a speech preview, a fraction of the memory.
      rec.buffer = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(await rec.blob.arrayBuffer());
      rec.duration = rec.buffer.duration;
    } catch {
      // Some browsers can't decode their own recording format: trim still works, just no waveform.
    }
  }
  for (const id of ['rec-in', 'rec-out']) $(id).max = rec.duration.toFixed(1);
  $('rec-in').value = '0';
  $('rec-out').value = rec.duration.toFixed(1);
  $('rec-title').value = '';
  $('rec-progress').hidden = true;
  $('rec-err').hidden = true;
  const st = stations.find((x) => x.slug === current);
  $('rec-send').textContent = st ? `Send to ${st.name}` : 'Send to station';
  recView('review');
  updateTrim();
}

function computePeaks(width) {
  const d = rec.buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / width));
  const peaks = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let p = 0;
    for (let i = x * step, e = Math.min(d.length, i + step); i < e; i++) p = Math.max(p, Math.abs(d[i]));
    peaks[x] = p;
  }
  return peaks;
}

function drawWave() {
  const c = $('rec-wave');
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; rec.peaks = null; }
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  if (!rec.buffer) {
    g.fillStyle = css.getPropertyValue('--muted');
    g.font = `${13 * dpr}px system-ui`;
    g.fillText('No waveform for this recording. Use Start and End below.', 10 * dpr, h / 2 + 4 * dpr);
    return;
  }
  if (!rec.peaks) rec.peaks = computePeaks(w);
  const a = Number($('rec-in').value) / rec.duration;
  const b = Number($('rec-out').value) / rec.duration;
  const keep = css.getPropertyValue('--green');
  const cut = css.getPropertyValue('--line');
  for (let x = 0; x < w; x++) {
    const bh = Math.max(dpr, rec.peaks[x] * h * 0.95);
    g.fillStyle = x / w >= a && x / w <= b ? keep : cut;
    g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}

// Keeps at least half a second between Start and End, whichever one is being dragged.
function updateTrim(e) {
  let a = Number($('rec-in').value);
  let b = Number($('rec-out').value);
  if (b - a < 0.5) {
    if (e?.target === $('rec-in')) a = Math.max(0, b - 0.5);
    else b = Math.min(rec.duration, a + 0.5);
    $('rec-in').value = a.toFixed(1);
    $('rec-out').value = b.toFixed(1);
  }
  $('rec-start-out').textContent = fmtT(a, true);
  $('rec-end-out').textContent = fmtT(b, true);
  $('rec-keep').textContent = fmtT(b - a);
  drawWave();
}
$('rec-in').oninput = updateTrim;
$('rec-out').oninput = updateTrim;
window.addEventListener('resize', () => { if (!$('rec-review').hidden) drawWave(); });

function stopPreview() {
  if (rec.player) { rec.player.stop?.(); rec.player.pause?.(); rec.player = null; }
  $('rec-play').textContent = '▶ Play kept part';
}

$('rec-play').onclick = async () => {
  if (rec.player) return stopPreview();
  const a = Number($('rec-in').value);
  const b = Number($('rec-out').value);
  $('rec-play').textContent = '■ Stop';
  if (rec.buffer) {
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = rec.buffer;
    src.connect(ctx.destination);
    src.onended = () => { ctx.close(); if (rec.player === src) stopPreview(); };
    src.start(0, a, b - a);
    rec.player = src;
  } else {
    const audio = new Audio(URL.createObjectURL(rec.blob));
    audio.currentTime = a;
    audio.ontimeupdate = () => { if (audio.currentTime >= b) stopPreview(); };
    audio.onended = stopPreview;
    rec.player = audio;
    audio.play().catch(stopPreview);
  }
};

function resetRecorder() {
  stopPreview();
  rec.blob = null;
  rec.buffer = null;
  rec.peaks = null;
  window.removeEventListener('beforeunload', warnUnsent);
  recView('idle');
}

$('rec-discard').onclick = () => {
  if (confirm('Discard this recording? It cannot be recovered.')) resetRecorder();
};

$('rec-send').onclick = () => {
  const title = $('rec-title').value.trim();
  const err = $('rec-err');
  err.hidden = true;
  if (!title) { err.textContent = 'Give the recording a title.'; err.hidden = false; $('rec-title').focus(); return; }
  stopPreview();
  const slug = current;
  const q = new URLSearchParams({ title, start: $('rec-in').value, end: $('rec-out').value });
  // XMLHttpRequest rather than fetch: it reports upload progress, which matters on slow mobile data.
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/stations/${slug}/recordings?${q}`);
  xhr.setRequestHeader('x-vg-request', '1');
  const bar = $('rec-progress');
  bar.hidden = false;
  bar.firstElementChild.style.width = '0%';
  $('rec-send').disabled = true;
  $('rec-send').textContent = 'Uploading…';
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    bar.firstElementChild.style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
    if (e.loaded === e.total) $('rec-send').textContent = 'Preparing audio…';
  };
  const done = (msg) => {
    $('rec-send').disabled = false;
    const st = stations.find((x) => x.slug === slug);
    $('rec-send').textContent = st ? `Send to ${st.name}` : 'Send to station';
    if (msg) { err.textContent = msg; err.hidden = false; bar.hidden = true; }
  };
  xhr.onload = () => {
    let body = {};
    try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
    if (xhr.status === 401) return showAuth();
    if (xhr.status !== 201) return done(body.error || `Upload failed (${xhr.status})`);
    done();
    resetRecorder();
    recNote(`"${body.title}" is in your library. Schedule it below.`);
    if (slug === current) loadTracks();
  };
  xhr.onerror = () => done('Upload failed: check your connection and press Send again. Your recording is still here.');
  xhr.send(rec.blob);
};

// ---- usage (FR-13) ----
const fmtBytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const fmtNum = (n) => (n >= 100 ? Math.round(n).toLocaleString() : String(n));

async function loadUsage() {
  if (!current) return;
  const slug = current;
  const u = await api(`/stations/${slug}/usage?days=30`);
  if (slug !== current) return;
  $('u-hours').textContent = fmtNum(u.listener_hours);
  $('u-peak').textContent = String(u.peak_listeners);
  $('u-streamed').textContent = fmtBytes(u.streamed_bytes);
  $('u-processed').textContent = fmtNum(u.processed_minutes);
  $('u-storage').textContent = fmtBytes(u.storage_bytes);
  $('u-quota').textContent = fmtBytes(u.storage_quota_bytes);
  const pct = Math.min(100, (u.storage_bytes / u.storage_quota_bytes) * 100);
  $('u-storage-bar').style.width = `${pct}%`;
  $('u-storage-bar').style.background = pct > 90 ? 'var(--danger)' : '';
  const max = Math.max(...u.daily.map((d) => d.listener_hours), 0);
  $('u-chart').replaceChildren(...u.daily.map((d) => {
    const bar = el('div', { title: `${d.day}: ${d.listener_hours} listener-hours, peak ${d.peak_listeners}` });
    bar.style.height = max ? `${Math.max(2, (d.listener_hours / max) * 100)}%` : '2%';
    if (!d.listener_hours) bar.className = 'zero';
    return bar;
  }));
  $('u-from').textContent = new Date(u.daily[0].day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

async function showAdmin() {
  const u = await api('/admin/usage?days=30');
  $('a-days').textContent = String(u.days);
  const t = u.totals;
  $('a-totals').replaceChildren(...[
    [t.stations, 'stations'], [fmtNum(t.listener_hours), 'listener-hours'], [fmtBytes(t.streamed_bytes), 'streamed (est.)'],
    [fmtBytes(t.storage_bytes), 'storage used'], [fmtNum(t.processed_minutes), 'recording minutes processed'],
  ].map(([v, label]) => el('div', {}, el('strong', { textContent: String(v) }), el('span', { textContent: label }))));
  $('a-rows').replaceChildren(...u.stations.map((r) => el('tr', {},
    el('td', {}, el('a', { href: `/s/${r.slug}`, target: '_blank', rel: 'noopener', textContent: r.name })),
    el('td', { textContent: r.owner ?? '—' }),
    el('td', { className: 'num', textContent: fmtNum(r.listener_hours) }),
    el('td', { className: 'num', textContent: String(r.peak_listeners) }),
    el('td', { className: 'num', textContent: fmtBytes(r.streamed_bytes) }),
    el('td', { className: 'num', textContent: fmtBytes(r.storage_bytes) }),
    el('td', { className: 'num', textContent: `${fmtNum(r.processed_minutes)} min` }),
  )));
  $('empty').hidden = true;
  $('station').hidden = true;
  $('admin').hidden = false;
  document.querySelectorAll('#stations button').forEach((b) => b.setAttribute('aria-current', 'false'));
}
$('admin-btn').onclick = () => showAdmin().catch((e) => alert(e.message));
$('admin-close').onclick = () => {
  $('admin').hidden = true;
  if (current) select(current); else $('empty').hidden = stations.length > 0;
};
