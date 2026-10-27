// VoxGarden Studio v0. Plain JS, no build step. All text goes through textContent.
const $ = (id) => document.getElementById(id);
const ENGINE = `${location.protocol}//${location.hostname}:8000`; // Icecast
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
  $('station').hidden = false;
  $('st-name').textContent = s.name;
  const url = `${ENGINE}/${s.slug}`;
  $('st-url').textContent = url;
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
    return el('li', {}, el('span', {}, t.filename), el('span', { className: 'size' }, fmtSize(t.bytes), ' ', del));
  }));
}

$('new-station').onsubmit = async (e) => {
  e.preventDefault();
  const err = $('ns-err');
  err.hidden = true;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const made = await api('/stations', {
      method: 'POST',
      body: JSON.stringify({ name: $('ns-name').value, slug: $('ns-slug').value }),
    });
    e.target.reset();
    await loadStations(made.slug);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
};

// Suggest a web address from the name until the user edits it themselves.
let slugTouched = false;
$('ns-slug').oninput = () => { slugTouched = true; };
$('ns-name').oninput = () => {
  if (slugTouched) return;
  $('ns-slug').value = $('ns-name').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
};

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
