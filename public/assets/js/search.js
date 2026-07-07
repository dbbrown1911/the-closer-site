// public/assets/js/search.js
// Talks to /api/search (the Netlify function). No secrets here — the
// function holds the credentials and returns clean JSON.

const els = {
  results: document.getElementById('results'),
  status: document.getElementById('status'),
  count: document.getElementById('count'),
  pager: document.getElementById('pager'),
  sort: document.getElementById('sort'),
  btn: document.getElementById('searchBtn'),
};

let currentPage = 1;

function money(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

function num(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-US');
}

function getFilters() {
  return {
    city: document.getElementById('city').value.trim(),
    minPrice: document.getElementById('minPrice').value,
    maxPrice: document.getElementById('maxPrice').value,
    beds: document.getElementById('beds').value,
    baths: document.getElementById('baths').value,
    sort: els.sort.value,
  };
}

function buildQuery(filters, page) {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
  p.set('page', page);
  return p.toString();
}

function cardHTML(l) {
  const photo = l.photo
    ? `<div class="photo" style="background-image:url('${l.photo}')"></div>`
    : `<div class="photo"><span class="noimg">Photo coming soon</span></div>`;
  const statusBadge = l.status ? `<span class="status">${l.status}</span>` : '';
  return `
    <a class="card" href="/listing?id=${encodeURIComponent(l.id)}">
      <div style="position:relative">${photo}${statusBadge}</div>
      <div class="body">
        <p class="price">${money(l.price)}</p>
        <p class="addr">${l.address || 'Address available on request'}</p>
        <p class="city">${[l.city, l.state].filter(Boolean).join(', ')} ${l.zip || ''}</p>
        <div class="meta">
          <span><b>${num(l.beds)}</b> <small>bd</small></span>
          <span><b>${num(l.baths)}</b> <small>ba</small></span>
          <span><b>${num(l.sqft)}</b> <small>sqft</small></span>
        </div>
      </div>
    </a>`;
}

function setStatus(html, cls = '') {
  els.status.innerHTML = html ? `<div class="notice ${cls}">${html}</div>` : '';
}

async function runSearch(page = 1) {
  currentPage = page;
  const filters = getFilters();
  els.results.innerHTML = '';
  els.pager.innerHTML = '';
  els.count.textContent = '';
  setStatus('<div class="spinner"></div>Searching ValleyMLS…');

  try {
    const res = await fetch('/api/search?' + buildQuery(filters, page));
    const data = await res.json();

    if (!res.ok) {
      const hint = data.message ? ` (${data.message})` : '';
      setStatus(`We couldn't load listings right now.${hint} Try again in a moment.`, 'error');
      return;
    }

    if (!data.results.length) {
      setStatus(page > 1
        ? 'No more listings on this page.'
        : 'No listings matched. Widen your price range or clear the city.');
      return;
    }

    setStatus('');
    els.results.innerHTML = data.results.map(cardHTML).join('');
    els.count.textContent = `${data.results.length} on this page`;
    renderPager(data.results.length, data.pageSize);
  } catch (err) {
    setStatus('Network error. Check your connection and try again.', 'error');
  }
}

function renderPager(countOnPage, pageSize) {
  const buttons = [];
  if (currentPage > 1) {
    buttons.push(`<button class="btn secondary" data-page="${currentPage - 1}">‹ Previous</button>`);
  }
  if (countOnPage === pageSize) {
    buttons.push(`<button class="btn secondary" data-page="${currentPage + 1}">Next ›</button>`);
  }
  els.pager.innerHTML = buttons.join('');
  els.pager.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      runSearch(Number(b.dataset.page));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
  );
}

els.btn.addEventListener('click', () => runSearch(1));
els.sort.addEventListener('change', () => runSearch(1));
document.querySelectorAll('.search-panel input').forEach((input) =>
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(1); })
);

// Load the market on first visit.
runSearch(1);
