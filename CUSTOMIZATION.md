# Customizing Ithomiini Maps for Your Own Data

This guide explains how to fork this Vue 3 app and adapt it to your own dataset.

## Quick Start

1. Fork this repository on GitHub.
2. Clone your fork locally:

   ```bash
   git clone https://github.com/<your-user>/<your-repo>.git
   cd <your-repo>
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy environment template:

   ```bash
   cp .env.example .env
   ```

5. Update app settings in `src/config.js`.
6. Put your JSON files in `public/data/` and update `public/data/data_manifest.json`.
7. Start dev server:

   ```bash
   npm run dev
   ```

## Data Format

Each source file in `public/data/` should be a JSON array of records.

Required fields:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique specimen/observation identifier |
| `scientific_name` | string | Full scientific name (used in species filters) |
| `genus` | string | Genus |
| `species` | string | Species epithet |
| `subspecies` | string | Subspecies epithet (or empty string) |
| `family` | string | Family name |
| `tribe` | string | Tribe name |
| `lat` | number | Latitude in decimal degrees |
| `lng` | number | Longitude in decimal degrees |
| `mimicry_ring` | string | Mimicry category label |
| `sequencing_status` | string | Sequencing/status label shown in filters |
| `source` | string | Source label; should match manifest key |

Common optional fields:

`image_url`, `country`, `collection_location`, `observation_date`, `date`, `preservation_date`, `sex`, `observation_url`.

## Data Manifest format

The app loads sources from `public/data/data_manifest.json`.

Example:

```json
{
  "sources": {
    "My Primary Dataset": { "file": "map_points_primary.json", "default": true },
    "My Secondary Dataset": { "file": "map_points_secondary.json", "default": false }
  },
  "image_supplement": "map_points_images.json"
}
```

- `sources` keys become source names in the sidebar.
- `file` points to a JSON file inside `public/data/`.
- Exactly one source should typically be marked with `default: true`.

## Configuration

All app-level settings are centralized in `src/config.js`:

- **App identity**: title, subtitle, header logo path, repository URL
- **Data settings**: data directory and manifest file naming
- **Database update settings**: worker URL and GitHub owner/repo from environment variables
- **Feature flags**: toggle optional UI modules without touching component logic

Recommended workflow: change `src/config.js` first, then only change component code if you need behavior that is not configurable.

## Feature Flags

In `src/config.js`:

```js
features: {
  mimicrySelector: true,
  goatIntegration: true,
  databaseUpdate: true,
  imageGallery: true,
}
```

Set a flag to `false` to hide that feature from the sidebar UI.

## Themes

Theme colors are controlled by CSS variables and styles used across:

- `src/style.css` (global styles)
- component style files such as `src/components/sidebar-styles.css`

To customize branding safely:

1. Change color variables/tokens only.
2. Keep existing class names and structure.
3. Verify readability for light/dark map backgrounds.

## Database Updates

Database update requests are proxied through a worker (not directly from browser to GitHub token).

1. Configure `.env` values:

   - `VITE_WORKER_URL`
   - `VITE_GITHUB_OWNER`
   - `VITE_GITHUB_REPO`

2. Ensure your worker validates the password server-side.
3. Ensure your worker triggers your GitHub Action workflow using secure secrets.

Important: client-side code should never contain hardcoded passwords or tokens.

## Deployment

### GitHub Pages (recommended)

1. In GitHub repository settings:
   - **Pages → Source**: GitHub Actions
   - **Actions → General → Workflow permissions**: Read and write
2. Push to your default branch with deployment workflow enabled.
3. For Vite + GitHub Pages, ensure `vite.config.js` `base` matches your repository path if needed.

After deployment, verify:

- Data files load from `public/data/`
- Sidebar features match your config flags
- Database update UI only appears when configured
