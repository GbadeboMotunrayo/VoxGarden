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
  renderStationHead(s);
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
