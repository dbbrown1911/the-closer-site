# DEPLOY — Tier 1 (get live data flowing)

Goal: real ValleyMLS listings rendering on the live site. ~15 minutes once
you have your two Bridge values.

## You need two values
- **Server Token** (Bridge → API Access Tokens) → `RESO_TOKEN`
- **OData endpoint** → `RESO_BASE_URL` =
  `https://api.bridgedataoutput.com/api/v2/OData/<dataset-name>`
  (no trailing slash, stop before /Property)

## Steps
1. **GitHub:** create an empty repo `the-closer-site`, then from the project folder:
   ```bash
   git init
   git add .
   git commit -m "The Closer ValleyMLS IDX site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/the-closer-site.git
   git push -u origin main
   ```
2. **Netlify:** Add new site → Import from Git → pick the repo.
   - Build command: *(blank)*
   - Publish directory: `public`
3. **Env vars** (Site settings → Environment variables → Add):
   ```
   RESO_TOKEN      = <your Server Token>
   RESO_BASE_URL   = https://api.bridgedataoutput.com/api/v2/OData/<dataset-name>
   DEFAULT_CITIES  = Huntsville,Madison,Athens,Harvest,Meridianville,Owens Cross Roads
   ```
   Leave RESO_TOKEN_URL / RESO_CLIENT_ID / RESO_CLIENT_SECRET / RESO_SCOPE blank.
4. **Redeploy:** Deploys → Trigger deploy (env vars only apply to new builds).

## Verify BEFORE pointing your domain
Open this on your Netlify URL:
```
https://YOUR-SITE.netlify.app/api/health
```
- `"ok": true` + `"Success — the feed is live"` → you're done; open the home page.
- `"ok": false` → the JSON tells you exactly what's wrong (missing var, bad
  endpoint, rejected token) and how to fix it.
- Check `field_report.expected_missing` — if it lists fields, the dataset
  renames them. Send me that block and I'll map them in minutes.

## Then
5. **Point your domain** (Netlify → Domain management → add
   thecloserrealestate.com). SSL is automatic.
6. Open the home page, run a search, open a listing, confirm photos load.

## Security reminder
Regenerate your Bridge tokens once (you photographed the old ones), capture the
new Server Token into a password manager, and update `RESO_TOKEN` in Netlify.
The token lives ONLY in Netlify env vars — never in the repo or front-end code.
