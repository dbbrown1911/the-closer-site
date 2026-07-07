// netlify/functions/health.js
// GET /api/health  — one-stop connection test. Open it in a browser after
// deploying. It NEVER returns your token; it only reports pass/fail and,
// on success, the field names the dataset actually uses (so any
// field-mapping fix is obvious).

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

  // Show a safe preview of the endpoint (no token in it).
  if (process.env.RESO_BASE_URL) {
    checks.base_url_preview = process.env.RESO_BASE_URL.replace(/\/$/, '');
    checks.base_url_has_trailing_property =
      /\/Property\/?$/i.test(process.env.RESO_BASE_URL);
  }

  if (!checks.RESO_BASE_URL_set || !checks.auth_configured) {
    return json(
      {
        ok: false,
        stage: 'config',
        message: 'Missing required environment variables.',
        checks,
        fix: 'Set RESO_BASE_URL and RESO_TOKEN in Netlify, then redeploy.',
      },
      500
    );
  }

  if (checks.base_url_has_trailing_property) {
    return json(
      {
        ok: false,
        stage: 'config',
        message: 'RESO_BASE_URL should end at the dataset name, not /Property.',
        checks,
        fix: 'Remove the /Property suffix from RESO_BASE_URL and redeploy.',
      },
      500
    );
  }

  // Live test: pull one Active listing.
  try {
    const rows = await resoQuery('Property', {
      $filter: "StandardStatus eq 'Active'",
      $top: 1,
    });

    if (!rows.length) {
      return json({
        ok: true,
        stage: 'connected',
        message: 'Connected, but no Active listings returned. Check status values or filters.',
        checks,
      });
    }

    const sample = rows[0];
    const fields = Object.keys(sample).sort();
    const hasInlineMedia = Array.isArray(sample.Media);

    // Report which display fields are present vs missing, so mapping is trivial.
    const expected = [
      'ListingKey', 'ListPrice', 'StandardStatus', 'UnparsedAddress', 'City',
      'StateOrProvince', 'PostalCode', 'BedroomsTotal', 'BathroomsTotalInteger',
      'LivingArea', 'PublicRemarks', 'PropertyType', 'PropertySubType', 'YearBuilt',
    ];
    const present = expected.filter((f) => f in sample);
    const missing = expected.filter((f) => !(f in sample));

    return json({
      ok: true,
      stage: 'connected',
      message: 'Success — the feed is live and returning data.',
      checks,
      field_report: {
        expected_present: present,
        expected_missing: missing,
        has_inline_media: hasInlineMedia,
        total_fields_returned: fields.length,
        all_fields: fields,
      },
    });
  } catch (err) {
    const status = err.status || 0;
    const hint =
      status === 401
        ? 'Token rejected — check RESO_TOKEN (Server Token) is correct.'
        : status === 404
        ? 'Endpoint not found — check the dataset name in RESO_BASE_URL.'
        : 'Request failed — see message.';
    return json(
      { ok: false, stage: 'live_query', status, message: err.message, hint, checks },
      502
    );
  }
};
