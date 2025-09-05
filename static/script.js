function setTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'light';
  setTheme(current === 'light' ? 'dark' : 'light');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1500);
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function buildQuery(options = {}) {
  const params = new URLSearchParams();
  if (options.id) params.set('id', options.id);
  if (options.category) params.set('category', options.category);
  if (options.length) params.set('length', options.length);
  if (options.q) params.set('q', options.q);
  if (options.mode) params.set('mode', options.mode);
  return params.toString();
}

let current = null;

async function loadQuote(options = {}) {
  const quoteEl = document.getElementById('quote');
  const authorEl = document.getElementById('author');
  const categoryEl = document.getElementById('category');
  try {
    quoteEl.textContent = 'Loading wisdom…';
    authorEl.textContent = '';
    categoryEl.textContent = '';
    const q = buildQuery(options);
    const res = await fetch(`/api/quote${q ? ('?' + q) : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    current = data;
    quoteEl.textContent = `“${data.text}”`;
    authorEl.textContent = data.author ? `— ${data.author}` : '';
    categoryEl.textContent = data.category || '';

    // Animate in
    quoteEl.classList.remove('in');
    requestAnimationFrame(() => quoteEl.classList.add('in'));

    updateFavoriteState();

    // Update URL with id for deep-link
    if (data.id && !options.id) {
      const url = new URL(location.href);
      url.searchParams.set('id', data.id);
      history.replaceState({}, '', url);
    }
  } catch (e) {
    quoteEl.textContent = 'Failed to load quote.';
    authorEl.textContent = '';
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme from preference or system
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (prefersDark ? 'dark' : 'light'));

  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('refresh')?.addEventListener('click', () => loadQuote(getCurrentOptions()));

  // Filters: category + length
  document.querySelectorAll('.chip[data-category]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-category]')?.forEach(b => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
      saveFilterState();
      loadQuote(getCurrentOptions());
    });
  });
  document.querySelectorAll('.chip[data-length]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      saveFilterState();
      loadQuote(getCurrentOptions());
    });
  });

  // Search
  const search = document.getElementById('search');
  if (search) {
    search.value = localStorage.getItem('filter.q') || '';
    const doSearch = () => { saveFilterState(); loadQuote(getCurrentOptions()); };
    let t = null;
    search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(doSearch, 250); });
  }

  // Daily toggle
  const dailyBtn = document.getElementById('daily-toggle');
  if (dailyBtn) {
    const dailySaved = localStorage.getItem('dailyMode') === '1';
    dailyBtn.setAttribute('aria-pressed', dailySaved ? 'true' : 'false');
    dailyBtn.addEventListener('click', () => {
      const pressed = dailyBtn.getAttribute('aria-pressed') === 'true';
      dailyBtn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      localStorage.setItem('dailyMode', pressed ? '0' : '1');
      loadQuote(getCurrentOptions());
    });
  }

  // Copy / Share
  document.getElementById('copy')?.addEventListener('click', copyQuote);
  document.getElementById('share')?.addEventListener('click', shareQuote);

  // Favorites
  document.getElementById('favorite')?.addEventListener('click', toggleFavorite);
  restoreFilterState();
  renderFavorites();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'n') {
      e.preventDefault();
      loadQuote(getCurrentOptions());
    } else if (e.key.toLowerCase() === 't') {
      toggleTheme();
    } else if (e.key.toLowerCase() === 'f') {
      toggleFavorite();
    } else if (e.key.toLowerCase() === 's') {
      shareQuote();
    } else if (e.key.toLowerCase() === 'c') {
      copyQuote();
    }
  });

  // Deep link: id param
  const id = qs('id');
  loadQuote(getCurrentOptions({ id }));

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js').catch(console.warn);
  }
});

function getCurrentOptions(extra = {}) {
  const categoryBtn = document.querySelector('.chip[data-category][aria-selected="true"]');
  const category = categoryBtn ? categoryBtn.getAttribute('data-category') : '';
  const shortBtn = document.querySelector('.chip[data-length]');
  const length = shortBtn && shortBtn.getAttribute('aria-pressed') === 'true' ? 'short' : '';
  const dailyMode = localStorage.getItem('dailyMode') === '1' ? 'daily' : '';
  const q = document.getElementById('search')?.value || '';
  const opts = {};
  if (category) opts.category = category;
  if (length) opts.length = length;
  if (dailyMode) opts.mode = dailyMode;
  if (q) opts.q = q;
  return Object.assign(opts, extra || {});
}

function saveFilterState() {
  const categoryBtn = document.querySelector('.chip[data-category][aria-selected="true"]');
  localStorage.setItem('filter.category', categoryBtn ? categoryBtn.getAttribute('data-category') : '');
  const short = document.querySelector('.chip[data-length]')?.getAttribute('aria-pressed') === 'true';
  localStorage.setItem('filter.short', short ? '1' : '0');
  const q = document.getElementById('search')?.value || '';
  localStorage.setItem('filter.q', q);
}

function restoreFilterState() {
  const cat = localStorage.getItem('filter.category') || '';
  const btn = document.querySelector(`.chip[data-category="${CSS.escape(cat)}"]`);
  if (btn) {
    document.querySelectorAll('.chip[data-category]')?.forEach(b => b.setAttribute('aria-selected', 'false'));
    btn.setAttribute('aria-selected', 'true');
  }
  const short = localStorage.getItem('filter.short') === '1';
  const sbtn = document.querySelector('.chip[data-length]');
  if (sbtn) sbtn.setAttribute('aria-pressed', short ? 'true' : 'false');
}

// Favorites management
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  } catch { return []; }
}
function setFavorites(list) {
  localStorage.setItem('favorites', JSON.stringify(list));
}
function isFavorited(id) {
  return getFavorites().some(q => q.id === id);
}
function updateFavoriteState() {
  const btn = document.getElementById('favorite');
  if (!btn || !current) return;
  const fav = isFavorited(current.id);
  btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
  btn.textContent = fav ? '♥ Favorited' : '♡ Favorite';
}
function toggleFavorite() {
  if (!current) return;
  const list = getFavorites();
  const idx = list.findIndex(q => q.id === current.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    showToast('Removed from favorites');
  } else {
    list.unshift({ id: current.id, text: current.text, author: current.author, category: current.category });
    showToast('Added to favorites');
  }
  setFavorites(list);
  updateFavoriteState();
  renderFavorites();
}
function renderFavorites() {
  const list = getFavorites();
  const container = document.getElementById('favorites-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<p class="muted">No favorites yet. Tap the heart to save quotes.</p>';
    return;
  }
  container.innerHTML = '';
  for (const q of list) {
    const item = document.createElement('div');
    item.className = 'item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `<p class="q">“${q.text}”</p><p class="a">— ${q.author || ''}</p>`;
    item.addEventListener('click', () => {
      // Load this favorite via id
      const url = new URL(location.href);
      url.searchParams.set('id', q.id);
      history.pushState({}, '', url);
      loadQuote({ id: q.id });
      document.getElementById('main')?.focus();
    });
    container.appendChild(item);
  }
}

async function copyQuote() {
  if (!current) return;
  const text = current.author ? `${current.text} — ${current.author}` : current.text;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    showToast('Copy failed');
  }
}

async function shareQuote() {
  if (!current) return;
  const text = current.author ? `${current.text} — ${current.author}` : current.text;
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'LogosMaximus', text, url });
    } catch (_) {}
  } else {
    await copyQuote();
  }
}
