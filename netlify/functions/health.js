// netlify/functions/health.js
const { resoQuery, authConfigured, json } = require('./lib/reso-client');

exports.handler = async () => {
  const checks = {
    RESO_BASE_URL_set: Boolean(process.env.RESO_BASE_URL),
    auth_configured: authConfigured(),
    base_url_preview: (process.env.RESO_BASE_URL || '').replace(/\/$/, ''),
  };
  if (!checks.RESO_BASE_URL_set || !checks.auth_configured) {
    return json({ ok: false, stage: 'config', checks }, 500);
  }

  const tally = (arr, key) => {
    const t = {};
    for (const r of arr) {
      let v = r[key];
      if (Array.isArray(v)) v = v.join('+');
      v = (v == null || v === '') ? '(missing)' : String(v);
      t[v] = (t[v] || 0) + 1;
    }
    return t;
  };

  try {
    const activeTry = await resoQuery('Property', {
      $filter: "StandardStatus eq 'Active'", $top: 3,
      $select: 'ListingKey,StandardStatus,City',
    }).catch((e) => ({ err: e.message }));

    const broad = await resoQuery('Property', {
      $top: 200, $select: 'StandardStatus,MlsStatus,FeedTypes',
    }).catch((e) => ({ err: e.message }));

    return json({
      ok: true,
      stage: 'diagnose',
      active_filter_returned: Array.isArray(activeTry) ? activeTry.length : activeTry,
      broad_sample: Array.isArray(broad) ? {
        sample_size: broad.length,
        StandardStatus_values: tally(broad, 'StandardStatus'),
        MlsStatus_values: tally(broad, 'MlsStatus'),
        FeedTypes_values: tally(broad, 'FeedTypes'),
      } : broad,
      checks,
    });
  } catch (err) {
    return json({ ok: false, stage: 'live_query', message: err.message, checks }, 502);
  }
};
