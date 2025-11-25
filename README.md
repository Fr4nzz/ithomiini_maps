# Ithomiini Distribution Maps

Interactive mapping tool for Ithomiini butterfly research. Visualize specimen distributions, sequencing status, and mimicry patterns across South America.

## 🔗 [Live Application](https://fr4nzz.github.io/ithomiini_maps/)

## Features

### 🗺️ Interactive Map
- **Multiple Base Layers**: Dark, Light, Satellite (Esri), Terrain, Streets
- **Clustered Points**: Efficient rendering of 30,000+ records
- **Dynamic Filtering**: Real-time map updates as filters change
- **Shareable URLs**: Filter state encoded in URL for easy sharing
- **Point Popups**: Click to view specimen details and images

### 📊 Data Table View
- **Sortable Columns**: Click headers to sort by any field
- **Pagination**: Navigate through large datasets efficiently
- **Column Visibility**: Toggle columns to customize your view
- **Status Badges**: Visual indicators for sequencing status

### 🔬 Filter System
- **Taxonomic Cascade**: Family → Tribe → Genus → Species → Subspecies
- **Sequencing Status**: Filter by Sequenced, Tissue Available, Preserved, Published, GBIF Record
- **Mimicry Rings**: 44 unique mimicry patterns from Dore et al. (2025)
- **CAMID Search**: Instant lookup by specimen ID
- **Data Source**: Filter by Dore, Sanger Institute, or GBIF

### 📥 Export & Citation
- **CSV Export**: Download filtered data as spreadsheet
- **GeoJSON Export**: Download for GIS/mapping applications
- **Scientific Citation**: Auto-generated citation with version hash
- **BibTeX Format**: Ready-to-use citation for LaTeX documents
- **Reproducibility**: Version-controlled data with Git commit hash

### 📊 Data Sources
1. **Dore et al. (2025)**: 28,927 published occurrence records with mimicry data
2. **Sanger Institute**: Live collection/sequencing data with specimen photos
3. **GBIF**: External occurrence enrichment (includes iNaturalist data)

## Tech Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Mapping**: MapLibre GL JS
- **State Management**: Pinia
- **Data Processing**: Python (Pandas)
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.9+

### Setup

```bash
# Clone the repository
git clone https://github.com/Fr4nzz/ithomiini_maps.git
cd ithomiini_maps

# Install JavaScript dependencies
npm install

# Start development server
npm run dev
```

### Data Processing

```bash
# Install Python dependencies
pip install -r scripts/requirements.txt

# Run data processing pipeline
# (Requires Dore_Ithomiini_records.xlsx in scripts/ folder)
cd scripts
python process_data.py
```

## Deployment

### Automatic Deployment (Recommended)
Push to `main` branch triggers automatic deployment via GitHub Actions.

### Manual Deployment
1. Build the application: `npm run build`
2. Deploy `dist/` folder to GitHub Pages

### GitHub Repository Settings Required:
1. **Settings → Pages → Source**: Select "GitHub Actions"
2. **Settings → Actions → General → Workflow permissions**: "Read and write"

## Project Structure

```
ithomiini_maps/
├── .github/workflows/
│   ├── deploy.yml          # Auto-deploy to GitHub Pages
│   └── update_data.yml     # Manual data refresh
├── public/data/
│   └── map_points.json     # Processed occurrence data
├── scripts/
│   ├── process_data.py     # ETL pipeline with mimicry lookup
│   └── requirements.txt    # Python dependencies
├── src/
│   ├── components/
│   │   ├── DataTable.vue   # Sortable, paginated data table
│   │   ├── ExportPanel.vue # CSV/GeoJSON export & citations
│   │   ├── MapEngine.vue   # MapLibre map component
│   │   └── Sidebar.vue     # Filter controls & view toggle
│   ├── stores/
│   │   └── data.js         # Pinia state management
│   ├── App.vue             # Root component with view switching
│   ├── main.js             # Entry point
│   └── style.css           # Global styles
├── index.html              # HTML template
├── package.json            # Node dependencies
└── vite.config.js          # Build configuration
```

## Data Schema

Each record in `map_points.json` contains:

```json
{
  "id": "CAM12345",
  "scientific_name": "Mechanitis menophilus",
  "genus": "Mechanitis",
  "species": "menophilus",
  "subspecies": "nevadensis",
  "family": "Nymphalidae",
  "tribe": "Ithomiini",
  "lat": -0.9234,
  "lng": -77.8123,
  "mimicry_ring": "Tiger",
  "sequencing_status": "Sequenced",
  "source": "Sanger Institute",
  "country": "Ecuador",
  "image_url": "https://wsrv.nl/?url=..."
}
```

## Credits

- **Project Lead**: Dr. Joana Meier (Wellcome Sanger Institute)
- **Development**: Franz Chandi
- **Data Sources**: 
  - Dore et al. (2025) - Published occurrence data
  - Sanger Institute - Sequencing data
  - GBIF - Global biodiversity data

## License

MIT License - See LICENSE file for details
