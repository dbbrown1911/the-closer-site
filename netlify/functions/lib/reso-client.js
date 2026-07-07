// netlify/functions/lib/reso-client.js
// Shared helper for talking to the ValleyMLS RESO Web API.
// This runs ONLY on the server (Netlify Functions), so your client
// secret is never exposed to the browser.

let cachedToken = null;
let cachedTokenExpiry = 0;

/**
 * Returns a valid bearer token.
 * - If RESO_TOKEN is set, uses it directly (static-token platforms).
 * - Otherwise performs an OAuth2 client_credentials grant and caches
 *   the result until just before it expires.
 */
async function getToken() {
  if (process.env.RESO_TOKEN) {
    return process.env.RESO_TOKEN;
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  const tokenUrl = process.env.RESO_TOKEN_URL;
  const clientId = process.env.RESO_CLIENT_ID;
  const clientSecret = process.env.RESO_CLIENT_SECRET;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing auth config. Set RESO_TOKEN, or RESO_TOKEN_URL + RESO_CLIENT_ID + RESO_CLIENT_SECRET.'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (process.env.RESO_SCOPE) {
    body.set('scope', process.env.RESO_SCOPE);
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh 60s early to avoid edge-of-expiry failures.
  const ttl = (data.expires_in || 3600) - 60;
  cachedTokenExpiry = now + ttl * 1000;
  return cachedToken;
}

/**
 * Runs an OData query against a RESO resource (e.g. 'Property', 'Media').
 * `params` is an object of OData system query options, e.g.
 *   { '$filter': "...", '$top': 24, '$orderby': 'ListPrice desc' }
 */
async function resoQuery(resource, params = {}) {
  const base = process.env.RESO_BASE_URL;
  if (!base) throw new Error('RESO_BASE_URL is not set.');

  const token = await getToken();
  const url = new URL(`${base.replace(/\/$/, '')}/${resource}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`RESO query failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.value || [];
}

/**
 * Like resoQuery, but if the request fails with a 400 (usually a bad
 * field name in $select/$orderby), it retries once with those optional
 * options stripped so the page still returns data. `optionalKeys` lists
 * the params to drop on retry.
 */
async function resoQuerySafe(resource, params = {}, optionalKeys = ['$select', '$orderby']) {
  try {
    return await resoQuery(resource, params);
  } catch (err) {
    if (err.status === 400) {
      const reduced = { ...params };
      for (const k of optionalKeys) delete reduced[k];
      return await resoQuery(resource, reduced);
    }
    throw err;
  }
}

/** Escape a value for safe inclusion inside an OData string literal. */
function odataString(value) {
  return String(value).replace(/'/g, "''");
}

/** True if at least one valid auth method is configured. */
function authConfigured() {
  if (process.env.RESO_TOKEN) return true;
  return Boolean(
    process.env.RESO_TOKEN_URL &&
      process.env.RESO_CLIENT_ID &&
      process.env.RESO_CLIENT_SECRET
  );
}

/** Standard JSON response with a short browser cache. */
function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Cache at the CDN edge for 5 min to cut API calls and stay snappy.
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
    body: JSON.stringify(body),
  };
}

module.exports = { getToken, resoQuery, resoQuerySafe, odataString, authConfigured, json };
