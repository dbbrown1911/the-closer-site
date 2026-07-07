// netlify/functions/search-listings.js
// GET /api/search?city=Huntsville&minPrice=200000&maxPrice=500000&beds=3&baths=2&page=1
// Returns active ValleyMLS listings matching the filters, with a primary photo.

const { resoQuery, resoQuerySafe, odataString, json } = require('./lib/reso-client');

const PAGE_SIZE = 24;

// RESO Data Dictionary fields we display. If ValleyMLS uses any custom
// field names, adjust them here (and in normalize() below).
const SELECT_FIELDS = [
  'ListingKey',
  'ListPrice',
  'StandardStatus',
  'UnparsedAddress',
  'City',
  'StateOrProvince',
  'PostalCode',
  'BedroomsTotal',
  'BathroomsTotalInteger',
  'LivingArea',
  'PropertyType',
  'PropertySubType',
  'ListAgentFullName',
  'ModificationTimestamp',
].join(',');

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};

    // --- Build the OData $filter ---
    const filters = ["StandardStatus eq 'Active'"];

    // Scope to your market unless a specific city is requested.
    if (q.city) {
      filters.push(`City eq '${odataString(q.city)}'`);
    } else if (process.env.DEFAULT_CITIES) {
      const cities = process.env.DEFAULT_CITIES.split(',')
        .map((c) => `City eq '${odataString(c.trim())}'`)
        .join(' or ');
      filters.push(`(${cities})`);
    }

    if (q.minPrice) filters.push(`ListPrice ge ${Number(q.minPrice)}`);
    if (q.maxPrice) filters.push(`ListPrice le ${Number(q.maxPrice)}`);
    if (q.beds) filters.push(`BedroomsTotal ge ${Number(q.beds)}`);
    if (q.baths) filters.push(`BathroomsTotalInteger ge ${Number(q.baths)}`);

    const page = Math.max(1, Number(q.page) || 1);

    const sortMap = {
      newest: 'ModificationTimestamp desc',
      price_asc: 'ListPrice asc',
      price_desc: 'ListPrice desc',
    };
    const orderby = sortMap[q.sort] || 'ModificationTimestamp desc';

    const listings = await resoQuerySafe('Property', {
      $select: SELECT_FIELDS,
      $filter: filters.join(' and '),
      $orderby: orderby,
      $top: PAGE_SIZE,
      $skip: (page - 1) * PAGE_SIZE,
    });

    // Fetch one primary photo per listing. We do a single Media query
    // for all keys on this page rather than N separate calls.
    const keys = listings.map((l) => l.ListingKey).filter(Boolean);
    const photos = await fetchPrimaryPhotos(keys);

    const results = listings.map((l) => normalize(l, photos[l.ListingKey]));

    return json({ page, pageSize: PAGE_SIZE, count: results.length, results });
  } catch (err) {
    return json({ error: 'search_failed', message: err.message }, 500);
  }
};

async function fetchPrimaryPhotos(keys) {
  if (!keys.length) return {};
  try {
    const orClause = keys
      .map((k) => `ResourceRecordKey eq '${odataString(k)}'`)
      .join(' or ');

    const media = await resoQuery('Media', {
      $select: 'ResourceRecordKey,MediaURL,Order',
      $filter: `(${orClause}) and MediaCategory eq 'Photo'`,
      $orderby: 'Order asc',
      $top: 500,
    });

    const map = {};
    for (const m of media) {
      // Keep the first (lowest Order) photo per listing.
      if (!map[m.ResourceRecordKey] && m.MediaURL) {
        map[m.ResourceRecordKey] = m.MediaURL;
      }
    }
    return map;
  } catch {
    // Photos are non-critical; never fail the whole search over them.
    return {};
  }
}

function normalize(l, photo) {
  return {
    id: l.ListingKey,
    price: l.ListPrice ?? null,
    status: l.StandardStatus ?? null,
    address: l.UnparsedAddress || '',
    city: l.City || '',
    state: l.StateOrProvince || '',
    zip: l.PostalCode || '',
    beds: l.BedroomsTotal ?? null,
    baths: l.BathroomsTotalInteger ?? null,
    sqft: l.LivingArea ?? null,
    type: l.PropertySubType || l.PropertyType || '',
    photo: photo || null,
  };
}
