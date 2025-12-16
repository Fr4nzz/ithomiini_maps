# React + Vite + shadcn/ui — Comprehensive Setup & Configuration Guide

This document provides detailed technical guidance for setting up a React + Vite project with shadcn/ui, specifically configured for the Ithomiini Maps application.

---

## 1) Project Creation (Vite + React + TypeScript)

### Option A: Using shadcn Create (Recommended)

We are using a custom Create preset with the following configuration:

| Setting | Value |
|---------|-------|
| Style | mira |
| Component Library | Base UI |
| Base Color | gray |
| Theme | lime |
| Icon Library | hugeicons |
| Template | vite |

**Preset URL:**
```
https://ui.shadcn.com/create?style=mira&base=base&baseColor=gray&theme=lime&iconLibrary=hugeicons&template=vite
```

**Installation command (npm):**
```bash
npx shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=mira&baseColor=gray&theme=lime&iconLibrary=hugeicons&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=vite" --template vite
```

### Option B: Manual Setup (if Create fails)

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npx shadcn@latest init
```

During `init`, select your preferences when prompted.

---

## 2) Tailwind CSS v4 Configuration

shadcn/ui now uses **Tailwind CSS v4**, which has significant configuration changes from v3.

### Required packages:
```bash
npm install tailwindcss @tailwindcss/vite
```

### Vite plugin setup (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### CSS entry point (`src/index.css`):
```css
@import "tailwindcss";
```

**Note:** Tailwind v4 uses CSS-based configuration. The `tailwind.config.js` file is no longer required for basic setups.

---

## 3) Path Alias Configuration (Critical)

shadcn/ui components use `@/` path aliases. You must configure this in **both** TypeScript config files.

### `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### `tsconfig.app.json` (often overlooked):
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Common pitfall:** If you only configure `tsconfig.json`, your IDE may resolve paths correctly but the build will fail. Always configure both files.

---

## 4) Base UI vs Radix UI

shadcn/ui now supports two underlying primitive libraries:

| Aspect | Radix UI | Base UI |
|--------|----------|---------|
| Maturity | Battle-tested, 3+ years | Newer, v1.0.0 in late 2024 |
| Package structure | Multiple `@radix-ui/react-*` packages | Single package |
| Community | Larger ecosystem | Growing |
| Recommendation | Safer for production | Fine for new projects |

**Our choice:** Base UI (with Radix as fallback if issues arise)

If you encounter missing primitives or broken behaviors with Base UI, you can regenerate components with Radix by running:
```bash
npx shadcn@latest init --force
```
And selecting Radix UI when prompted.

---

## 5) Dark Mode (ThemeProvider for Vite)

shadcn provides a Vite-specific ThemeProvider that doesn't depend on Next.js.

### Create `src/components/theme-provider.tsx`:
```typescript
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
```

### Prevent flash of wrong theme (`index.html`):
Add this script in `<head>` before any stylesheets:
```html
<script>
  (function() {
    const theme = localStorage.getItem('vite-ui-theme') || 'system';
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
  })();
</script>
```

### Wrap your app (`src/main.tsx`):
```typescript
import { ThemeProvider } from '@/components/theme-provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="ithomiini-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
```

---

## 6) Adding shadcn Components

### CLI commands:
```bash
# Initialize (if not using Create)
npx shadcn@latest init

# Add individual components
npx shadcn@latest add button card tabs dialog sheet select popover command sonner

# Add multiple components at once
npx shadcn@latest add button card sheet dialog select popover command tabs scroll-area separator badge tooltip
```

### Recommended components for Ithomiini Maps:
- `button` - Actions, toggles
- `card` - Data containers
- `sheet` - Side panels, details view (replaces MapLibre popups)
- `dialog` - Modals (export, mimicry selector)
- `select` - Taxonomy dropdowns
- `popover` - Hover tooltips
- `command` - Fuzzy search (CAMID search)
- `tabs` - View switching (map/table)
- `scroll-area` - Scrollable lists
- `separator` - Visual dividers
- `badge` - Status indicators
- `tooltip` - Hover hints
- `slider` - Range inputs (date range)
- `switch` - Toggles (clustering, scatter)
- `sonner` - Toast notifications

---

## 7) Icon Libraries

### Primary: Hugeicons (as configured)
```bash
npm install @hugeicons/react @hugeicons/core-free-icons
```

Usage:
```typescript
import { Search01Icon } from '@hugeicons/react'

<Search01Icon className="h-4 w-4" />
```

### Alternative: Lucide React (shadcn default)
If Hugeicons causes issues, Lucide is the shadcn default with excellent tree-shaking:

```bash
npm install lucide-react
```

**Vite optimization for Lucide** (reduces dev build time significantly):
```typescript
// vite.config.ts
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'lucide-react/icons': fileURLToPath(
        new URL('./node_modules/lucide-react/dist/esm/icons', import.meta.url)
      ),
    },
  },
})
```

---

## 8) GitHub Pages Deployment

### Vite base path configuration:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/ithomiini_maps/',
  // ... other config
})
```

### Build-time constants:
```typescript
// vite.config.ts
import { execSync } from 'child_process'

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(
      process.env.GITHUB_SHA || 
      execSync('git rev-parse --short HEAD').toString().trim()
    ),
  },
})
```

### TypeScript declarations (`src/vite-env.d.ts`):
```typescript
/// <reference types="vite/client" />

declare const __BUILD_TIME__: string
declare const __COMMIT_HASH__: string
```

### GitHub Actions workflow (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          GITHUB_SHA: ${{ github.sha }}
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### SPA Routing on GitHub Pages

**Recommended: HashRouter**

GitHub Pages is a static file server. Deep links like `/ithomiini_maps/species/123` will return 404 because no such file exists.

Use HashRouter for reliable client-side routing:
```typescript
import { HashRouter } from 'react-router-dom'

// URLs become: /ithomiini_maps/#/species/123
<HashRouter>
  <Routes>...</Routes>
</HashRouter>
```

**Alternative: URL state without router**

For a single-page map app, you may not need a router at all. Use query params:
```
/ithomiini_maps/?lat=-0.5&lng=-78.5&zoom=8&species=Ithomia
```

See the `nuqs` library in EQUIVALENTS_VUE_TO_REACT.md for type-safe URL state management.

---

## 9) React 18 Strict Mode Considerations

React 18's Strict Mode intentionally double-mounts components to stress-test effect cleanup. This can break map libraries that don't clean up properly.

**Symptoms:**
- "Ghost" markers that persist after component unmount
- Memory leaks
- "dispatcher is null" errors
- Duplicate map instances

**Solutions:**
1. Ensure map initialization is in a `useEffect` with proper cleanup
2. Use refs to track initialization state
3. Use libraries specifically patched for React 18 (see EQUIVALENTS doc)

```typescript
// Correct pattern for map initialization
const mapRef = useRef<MapLibreMap | null>(null)
const containerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (mapRef.current || !containerRef.current) return
  
  mapRef.current = new MapLibreMap({
    container: containerRef.current,
    // ... config
  })
  
  return () => {
    mapRef.current?.remove()
    mapRef.current = null
  }
}, [])
```

---

## 10) Development Workflow

### Start dev server:
```bash
npm run dev
```

### Build for production:
```bash
npm run build
```

### Preview production build locally:
```bash
npm run preview
```

### Type checking:
```bash
npx tsc --noEmit
```

### Lint:
```bash
npm run lint
```

---

## Quick Reference Links

- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite)
- [shadcn/ui Dark Mode (Vite)](https://ui.shadcn.com/docs/dark-mode/vite)
- [shadcn/ui CLI](https://ui.shadcn.com/docs/cli)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Vite Configuration](https://vite.dev/config/)
- [Hugeicons React](https://hugeicons.com/docs/integrations/react/overview)
