# The Closer Real Estate Group — ValleyMLS IDX Site

A static site + serverless functions that pulls **live ValleyMLS listings**
into your own website. Your only recurring costs are **hosting (free on Netlify)
+ the ValleyMLS data feed fee (~$5/mo)**. No third-party IDX vendor.

Your API secret never touches the browser — it lives in a Netlify Function.

```
the-closer-site/
├── netlify.toml                 Netlify config + /api routes
├── package.json                 No runtime deps
├── .env.example                 Which credentials you need
├── public/                      The website (what visitors see)
│   ├── index.html               Home + search
│   ├── listing.html             Single-listing detail
│   └── assets/css | js
└── netlify/functions/           Server-side (holds your credentials)
    ├── search-listings.js       /api/search
    ├── get-listing.js           /api/listing
    └── lib/reso-client.js       Auth + OData helper
```

## Platform: Bridge (Bridge Data Output / Zillow Group)

ValleyMLS issues this feed through **Bridge**. Bridge uses a **static server
token** — simpler than OAuth. You set exactly two environment variables:

- `RESO_TOKEN` — your Bridge **Server Token** (a long string; treat like a password)
- `RESO_BASE_URL` — your Bridge OData endpoint, in this format:
  `https://api.bridgedataoutput.com/api/v2/OData/<dataset-name>`
  `<dataset-name>` is ValleyMLS's dataset slug, shown on your Bridge app page.

Leave `RESO_TOKEN_URL`, `RESO_CLIENT_ID`, `RESO_CLIENT_SECRET`, `RESO_SCOPE`
**blank**. The code sees `RESO_TOKEN` is set and uses it directly.

### Getting approved on Bridge
1. Finish the **Application Profile** (Product Type = IDX, Class = Broker,
   Office = The Closer Real Estate Group). Put a real name in *Product Name*
   (e.g. "The Closer IDX Site") and your URL in *Website URL*.
2. On the **Application Settings** page: leave **IP Address Allowlist EMPTY**
   (Netlify has no fixed outbound IP — pinning IPs will block your feed).
   HTTP Referrer Domains and OAuth Redirect URL can stay blank for a
   server-side feed.
3. Once approved, copy the **Server Token** and **OData endpoint URL**.

## Deploy (about 15 minutes)

1. **Put this folder in a GitHub repo.** Create a repo, push these files.
2. **Create a Netlify site.** Netlify → *Add new site → Import from Git* → pick the repo.
   Build command: *(leave blank)*. Publish directory: `public`. Deploy.
3. **Add your credentials.** Netlify → *Site settings → Environment variables* →
   add the values from `.env.example` (real values, not the template).
4. **Redeploy** so the functions pick up the variables (*Deploys → Trigger deploy*).
5. **Point your domain.** Netlify → *Domain management* → add `thecloserrealestate.com`
   and follow the DNS steps. SSL is automatic and free.
6. **Lead emails.** Forms submit through **Netlify Forms** (built in, free tier).
   Netlify → *Forms* to see submissions; set up email notifications there.

To run it locally first: `npm i -g netlify-cli` then `netlify dev`.

## Adjusting field names

The functions use **RESO Data Dictionary** standard field names (`ListPrice`,
`StandardStatus`, `City`, `BedroomsTotal`, `BathroomsTotalInteger`, `LivingArea`,
`UnparsedAddress`, `PublicRemarks`, `Media` resource, etc.). Most ValleyMLS feeds
match these. If something returns blank, check the feed's `$metadata` for the real
field name and update it in:

- `netlify/functions/search-listings.js` → `SELECT_FIELDS` and `normalize()`
- `netlify/functions/get-listing.js` → the response object
- Photos: the detail page uses Bridge's inline `Media` array when present and
  falls back to a separate `Media` resource query (`ResourceRecordKey`,
  `MediaURL`, `Order`, `MediaCategory='Photo'`). Search uses the `Media` query.
  If photos come back empty after going live, send a sample listing's JSON.

## IDX compliance (don't skip)

ValleyMLS will revoke the feed if display rules aren't met. The scaffold leaves
hooks for these — fill them with the exact text from your IDX agreement:

- Brokerage name shown (it's in the header/footer already).
- Required attribution / disclaimer — edit `#idx-disclaimer` text in both pages.
- Refresh on ValleyMLS's required cadence (the edge cache is set to 5 min).
- Don't display statuses ValleyMLS prohibits; the search is limited to `Active`.
- Don't mix in listings from another MLS without disclosure.
