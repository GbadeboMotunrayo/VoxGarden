// Landing page: mobile menu, and the "On air now" list from real station data.
const menu = document.getElementById('menu');
const menuBtn = document.getElementById('menu-btn');
menuBtn.onclick = () => {
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
};
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
});

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  kids.forEach((k) => n.append(k));
  return n;
}

// Only stations that are actually broadcasting are listed; nothing here is made up.
async function loadLive() {
  try {
    const res = await fetch('/public/live', { cache: 'no-store' });
    const stations = res.ok ? await res.json() : [];
    const list = document.getElementById('live-list');
    list.replaceChildren(...stations.map((s) => {
      const meta = [s.category, [s.city, s.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
      const listening = s.listeners > 0 ? ` · ${s.listeners} listening` : '';
      return el('li', {}, el('a', { href: `/s/${s.slug}` },
        el('img', { src: s.logo ?? '/public/default-logo.svg', alt: '', width: 56, height: 56, loading: 'lazy' }),
        el('span', {}, el('strong', { textContent: s.name }), el('small', { textContent: meta + listening }))));
    }));
    document.getElementById('live-empty').hidden = stations.length > 0;
  } catch {
    document.getElementById('live-empty').hidden = false;
  }
}
loadLive();
