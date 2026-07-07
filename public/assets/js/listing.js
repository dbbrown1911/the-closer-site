// public/assets/js/listing.js
// Reads ?id= from the URL, calls /api/listing, renders the detail view.

const root = document.getElementById('detail');
const params = new URLSearchParams(location.search);
const id = params.get('id');

function money(n) { return n == null ? '—' : '$' + Number(n).toLocaleString('en-US'); }
function num(n) { return n == null ? '—' : Number(n).toLocaleString('en-US'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function galleryHTML(photos) {
  if (!photos.length) {
    return `<div class="notice">No photos provided for this listing.</div>`;
  }
  return `<div class="gallery">${photos.slice(0, 5)
    .map((u) => `<img src="${esc(u)}" alt="Listing photo" loading="lazy" />`)
    .join('')}</div>`;
}

function render(l) {
  document.title = `${l.address || 'Listing'} — The Closer Real Estate Group`;
  root.innerHTML = `
    ${galleryHTML(l.photos)}
    <div class="detail-head">
      <div>
        <p class="addr">${esc(l.address) || 'Address available on request'}</p>
        <p class="city">${[l.city, l.state].filter(Boolean).map(esc).join(', ')} ${esc(l.zip)}</p>
      </div>
      <p class="price">${money(l.price)}</p>
    </div>

    <div class="facts">
      <div><b>${num(l.beds)}</b><small>Beds</small></div>
      <div><b>${num(l.baths)}</b><small>Baths</small></div>
      <div><b>${num(l.sqft)}</b><small>Sq Ft</small></div>
      <div><b>${esc(l.yearBuilt) || '—'}</b><small>Year Built</small></div>
      <div><b>${esc(l.type) || '—'}</b><small>Type</small></div>
      <div><b>${esc(l.status) || '—'}</b><small>Status</small></div>
    </div>

    ${l.remarks ? `<p class="remarks">${esc(l.remarks)}</p>` : ''}

    <div class="lead">
      <h3>Ask about this home</h3>
      <p class="s">Want a showing or more detail? Send a note and we'll be in touch.</p>
      <form name="listing-inquiry" method="POST" data-netlify="true" netlify-honeypot="bot-field">
        <input type="hidden" name="form-name" value="listing-inquiry" />
        <input type="hidden" name="listing-id" value="${esc(l.id)}" />
        <input type="hidden" name="listing-address" value="${esc(l.address)}" />
        <p hidden><label>Skip: <input name="bot-field" /></label></p>
        <div class="row">
          <input type="text" name="name" placeholder="Your name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="tel" name="phone" placeholder="Phone (optional)" />
          <input type="text" name="when" placeholder="Best time to reach you" />
          <textarea name="message" placeholder="I'd like to know more about ${esc(l.address)}…"></textarea>
        </div>
        <button class="btn" type="submit" style="margin-top:16px;">Request info</button>
      </form>
    </div>

    <p style="color:var(--slate); font-size:.85rem; margin-top:22px;">
      ${l.listOffice ? 'Listed by ' + esc(l.listOffice) + (l.listAgent ? ' · ' + esc(l.listAgent) : '') + '. ' : ''}
      Listing courtesy of ValleyMLS.
    </p>`;
}

async function load() {
  if (!id) {
    root.innerHTML = `<div class="notice error">No listing specified. <a href="/#search">Back to search</a>.</div>`;
    return;
  }
  try {
    const res = await fetch('/api/listing?id=' + encodeURIComponent(id));
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error === 'not_found'
        ? 'This listing is no longer available.'
        : 'We couldn\'t load this listing right now.';
      root.innerHTML = `<div class="notice error">${msg} <a href="/#search">Back to search</a>.</div>`;
      return;
    }
    render(data);
  } catch (err) {
    root.innerHTML = `<div class="notice error">Network error. <a href="/#search">Back to search</a>.</div>`;
  }
}

load();
