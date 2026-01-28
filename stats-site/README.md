# Riftbound Stats – Deployable stats site

Static site that shows card winrate when played from [Riftbound Tracker](https://github.com/...) exports. No backend; data is imported via file/paste and optionally stored in the browser.

## Features

- **Import**: Drag-and-drop JSON file or paste export from Riftbound Tracker
- **Overview**: Total games, wins, overall winrate
- **Winrate by day**: Bar chart of daily winrate (when dates are in the export)
- **Card table**: Per-card “games played”, “wins when played”, “winrate when played”
- **Sortable columns**: Click table headers to sort
- **Search**: Filter cards by name
- **Persist**: Last imported data is stored in `localStorage` so reopening the site shows your stats

## Deploy as a proper site

The site is static (HTML + CSS + JS). Host it anywhere that serves static files.

### Option 1: GitHub Pages

1. Create a repo (e.g. `riftbound-stats`) and push this folder’s contents (or the whole project with the site in a subfolder).
2. **If the site is in the repo root**:  
   Settings → Pages → Source: “Deploy from a branch” → Branch: `main` (or `master`) → folder: `/ (root)` → Save.
3. **If the site is in a subfolder** (e.g. `stats-site/`):  
   Set “Source” to the branch and choose the folder that contains `index.html`, or use a custom GitHub Action to copy `stats-site/*` into the Pages root.

   Simpler: put only the stats site in a branch or in the root. Example structure:

   ```
   your-repo/
     index.html      (from stats-site)
     styles.css
     app.js
     README.md
   ```

4. The site will be at `https://<username>.github.io/<repo>/`.

### Option 2: Netlify

1. Sign up at [netlify.com](https://netlify.com).
2. “Add new site” → “Deploy manually” or connect your Git repo.
3. **Manual deploy**: Drag the `stats-site` folder (containing `index.html`, `styles.css`, `app.js`) into the Netlify drop zone.  
   **Git deploy**: Set “Publish directory” to `stats-site` (or the folder where `index.html` lives).
4. Netlify gives you a URL like `https://random-name.netlify.app`. You can set a custom domain in Site settings.

### Option 3: Vercel

1. Install Vercel CLI: `npm i -g vercel` (or use the [Vercel dashboard](https://vercel.com)).
2. In the project root, run `vercel` and follow the prompts. Set the “root directory” to `stats-site` when asked (or deploy from inside `stats-site`).
3. Your site will be at `https://<project>.vercel.app`.

### Option 4: Any static host

Upload the contents of `stats-site` (at least `index.html`, `styles.css`, `app.js`) to any host that serves static files (e.g. Cloudflare Pages, AWS S3 + CloudFront, your own server). The site works with no build step and no server-side code.

## Data flow

1. In **Riftbound Tracker** (browser extension): record wins/losses, then click “Export data” to download a JSON file.
2. Open this **stats site** (locally or deployed).
3. Drop the JSON file or paste its contents, then click “Load data” (or rely on auto-load on paste).
4. View overall stats, winrate by day, and per-card winrate when played. Data is kept in `localStorage` until you click “Clear stored data” or clear site data.

## Files

- `index.html` – Single-page layout (import area, dashboard, table).
- `styles.css` – Layout and theme.
- `app.js` – Parse export, compute stats, render table/chart, sort/filter, localStorage.

No dependencies; no build step.
