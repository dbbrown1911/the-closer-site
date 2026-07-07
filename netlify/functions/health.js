// netlify/functions/health.js
const { resoQuery, authConfigured, json } = require('./lib/reso-client');

exports.handler = async () => {
  const checks = {
    RESO_BASE_URL_set: Boolean(process.env.RESO_BASE_URL),
    auth_configured: authConfigured(),
    auth_method: process.env.RESO_TOKEN
      ? 'static token (Bridge)'
      : authConfigured()
      ? 'oauth client_credentials'
      : 'NONE',
  };

  if (process.env.RESO_BASE_URL) {
    checks.base_url_preview = process.env.RESO_BASE_URL.replace(/\/$/, '');
    checks.base_url_has_trailing_property =
      /\/Property\/?$/i.test(process.env.RESO_BASE_URL);
  }

  if (!checks.RESO_BASE_URL_set || !checks.auth_configured) {
    return json({ ok: false, stage: 'config', message: 'Missing required environment variables.', checks }, 500);
  }

  try {
    const rows = await resoQuery('Property', { $filter: "StandardStatus eq 'Active'", $top: 1 });

    if (!rows.length) {
      const probe = await resoQuery('Property', {
        $top: 30,
        $select: 'ListingKey,StandardStatus,MlsStatus,City,ListPrice',
        $orderby: 'ModificationTimestamp desc',
      }).catch((e) => ({ probe_error: e.message }));

      let status_probe;
      if (Array.isArray(probe)) {
        const standard = {}, mls = {};
        for (const r of probe) {
          const s = r.StandardStatus == null ? '(missing)' : String(r.StandardStatus);
          const m = r.MlsStatus == null ? '(missing)' : String(r.MlsStatus);
          standard[s] = (standard[s] || 0) + 1;
          mls[m] = (mls[m] || 0) + 1;
        }
        status_probe = { sample_size: probe.length, StandardStatus_values: standard, MlsStatus_values: mls, sample_fields: probe.length ? Object.keys(probe[0]).sort() : [] };
      } else {
        status_probe = probe;
      }

      return json({ ok: true, stage: 'connected_no_active', message: "StandardStatus='Active' returned nothing — see status_probe.", checks, status_probe });
    }

    const sample = rows[0];
    return json({ ok: true, stage: 'connected', message: 'Success — feed is live.', checks, all_fields: Object.keys(sample).sort() });
  } catch (err) {
    const status = err.status || 0;
    return json({ ok: false, stage: 'live_query', status, message: err.message, checks }, 502);
  }
};
