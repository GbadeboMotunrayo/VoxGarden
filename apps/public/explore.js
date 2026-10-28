// Explore (FR-11): load every public station once, then search and filter in the
// browser, so typing is instant even on a slow connection. Filters live in the URL
// (?q=&cat=&lang=&place=&live=1) so a filtered view can be shared.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let stations = [];
let place = params.get('place') ?? '';

const menu = $('menu');
$('menu-btn').onclick = () => {
  const open = menu.classList.toggle('open');
  $('menu-btn').setAttribute('aria-expanded', String(open));
};

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  kids.forEach((k) => n.append(k));
  return n;
}

// Accent-insensitive matching, so "orun" finds "Ọ̀run" and "abeokuta" finds "Abẹ́òkúta".
const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const placeOf = (s) => [s.city, s.country].filter(Boolean).join(', ');

function options(id, values) {
  const sel = $(id);
  const keep = sel.value;
  sel.replaceChildren(el('option', { value: '', textContent: 'All' }),
    ...[...new Set(values.filter(Boolean))].sort().map((v) => el('option', { value: v, textContent: v })));
  sel.value = keep;
}

function renderPlaces() {
  const counts = new Map();
  for (const s of stations) { const p = s.city || s.country; if (p) counts.set(p, (counts.get(p) ?? 0) + 1); }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  $('ex-places').replaceChildren(...(sorted.length ? [el('span', { className: 'muted', textContent: 'Places:' })] : []),
    ...sorted.map(([p, n]) => {
      const b = el('button', { type: 'button', className: 'place', textContent: `${p} ${n}` });
      b.setAttribute('aria-pressed', String(place === p));
      b.onclick = () => { place = place === p ? '' : p; render(); };
      return b;
    }));
}

function syncUrl() {
  const q = new URLSearchParams();
  if ($('ex-q').value.trim()) q.set('q', $('ex-q').value.trim());
  if ($('ex-cat').value) q.set('cat', $('ex-cat').value);
  if ($('ex-lang').value) q.set('lang', $('ex-lang').value);
  if (place) q.set('place', place);
  if ($('ex-live').checked) q.set('live', '1');
  history.replaceState(null, '', q.size ? `?${q}` : location.pathname);
}

function render() {
  // Every word must appear somewhere, in any order: "hausa market" finds the Hausa market show.
  const words = fold($('ex-q').value).split(/\s+/).filter(Boolean);
  const cat = $('ex-cat').value;
  const lang = $('ex-lang').value;
  const liveOnly = $('ex-live').checked;
  const shown = stations.filter((s) =>
    words.every((w) => fold(`${s.name} ${s.description} ${s.category} ${s.language} ${placeOf(s)}`).includes(w)) &&
    (!cat || s.category === cat) && (!lang || s.language === lang) &&
    (!place || s.city === place || s.country === place) && (!liveOnly || s.on_air));
  // Live first, then most listeners, then name.
  shown.sort((a, b) => Number(b.on_air) - Number(a.on_air) || b.listeners - a.listeners || a.name.localeCompare(b.name));

  $('ex-grid').replaceChildren(...shown.map((s) => {
    const tags = [s.category, s.language, placeOf(s)].filter(Boolean);
    const status = s.on_air
      ? el('span', { className: 'ex-live' }, el('span', { className: 'live-dot', ariaHidden: 'true' }), s.listeners > 0 ? `Live · ${s.listeners} listening` : 'Live')
      : el('span', { className: 'ex-off', textContent: 'Off air' });
    return el('li', {}, el('a', { href: `/s/${s.slug}`, className: 'ex-card' },
      el('img', { src: s.logo ?? '/public/default-logo.svg', alt: '', width: 72, height: 72 }),
      el('div', {},
        status,
        el('h2', { textContent: s.name }),
        el('p', { className: 'ex-tags' }, ...tags.map((t) => el('span', { textContent: t }))),
        s.description ? el('p', { className: 'ex-desc', textContent: s.description }) : '')));
  }));
  const live = shown.filter((s) => s.on_air).length;
  $('ex-count').textContent = stations.length
    ? `${shown.length} station${shown.length === 1 ? '' : 's'}${live ? `, ${live} on air now` : ''}`
    : '';
  $('ex-empty').hidden = shown.length > 0 || !stations.length;
  renderPlaces();
  syncUrl();
}

async function load() {
  try {
    const res = await fetch('/public/stations', { cache: 'no-store' });
    stations = res.ok ? await res.json() : [];
  } catch {
    stations = [];
  }
  options('ex-cat', stations.map((s) => s.category));
  options('ex-lang', stations.map((s) => s.language));
  render();
  if (!stations.length) { $('ex-empty').hidden = false; $('ex-count').textContent = ''; }
}

$('ex-q').value = params.get('q') ?? '';
$('ex-live').checked = params.get('live') === '1';
$('ex-form').onsubmit = (e) => e.preventDefault();
$('ex-q').oninput = render;
for (const id of ['ex-cat', 'ex-lang', 'ex-live']) $(id).onchange = render;
load().then(() => {
  if (params.get('cat')) $('ex-cat').value = params.get('cat');
  if (params.get('lang')) $('ex-lang').value = params.get('lang');
  render();
});
// Live status changes: refresh every 30 s while the page is visible.
setInterval(() => { if (!document.hidden) load(); }, 30_000);
