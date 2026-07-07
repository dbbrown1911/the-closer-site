// netlify/functions/get-listing.js
// GET /api/listing?id=LISTINGKEY
// Returns full detail for one listing plus its photo gallery.

const { resoQuery, odataString, json } = require('./lib/reso-client');

exports.handler = async (event) => {
  try {
    const id = (event.queryStringParameters || {}).id;
    if (!id) return json({ error: 'missing_id' }, 400);

    const rows = await resoQuery('Property', {
      $filter: `ListingKey eq '${odataString(id)}'`,
      $top: 1,
    });

    if (!rows.length) return json({ error: 'not_found' }, 404);
    const l = rows[0];

    // Bridge often embeds a Media array on the listing record itself.
    // Use it when present; otherwise query the Media resource.
    let photos = [];
    if (Array.isArray(l.Media) && l.Media.length) {
      photos = l.Media
        .filter((m) => !m.MediaCategory || m.MediaCategory === 'Photo')
        .sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
        .map((m) => m.MediaURL)
        .filter(Boolean);
    } else {
      const media = await resoQuery('Media', {
        $select: 'MediaURL,Order',
        $filter: `ResourceRecordKey eq '${odataString(id)}' and MediaCategory eq 'Photo'`,
        $orderby: 'Order asc',
        $top: 100,
      }).catch(() => []);
      photos = media.map((m) => m.MediaURL).filter(Boolean);
    }

    return json({
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
      yearBuilt: l.YearBuilt ?? null,
      lotSize: l.LotSizeAcres ?? null,
      type: l.PropertySubType || l.PropertyType || '',
      remarks: l.PublicRemarks || '',
      listAgent: l.ListAgentFullName || '',
      listOffice: l.ListOfficeName || '',
      photos,
    });
  } catch (err) {
    return json({ error: 'listing_failed', message: err.message }, 500);
  }
};
