# shadcn-vue Migration Plan

## Overview

This plan outlines the migration of the Ithomiini Maps app from custom CSS components to **shadcn-vue** - a Vue port of the popular shadcn/ui component library. This will reduce code complexity, improve accessibility (WAI-ARIA compliance), and create a consistent, maintainable design system.

**Current Stack:** Vue 3 + Vite + JavaScript + Custom CSS with CSS Variables
**Target Stack:** Vue 3 + Vite + JavaScript + Tailwind CSS + shadcn-vue (Reka UI)

---

## Phase 1: Foundation Setup

### 1.1 Install Tailwind CSS 4 (Required for shadcn-vue)
```bash
npm install tailwindcss @tailwindcss/vite
```

Update `vite.config.js` to add Tailwind plugin.

### 1.2 Configure Tailwind with Dark Theme
- Create `src/index.css` with Tailwind imports and CSS variables
- Map existing CSS variables to Tailwind's theming system
- Preserve the current dark scientific theme colors:
  - `--color-bg-primary: #1a1a2e` → `--background`
  - `--color-accent: #4ade80` → `--primary`
  - etc.

### 1.3 Install shadcn-vue CLI
```bash
npx shadcn-vue@latest init
```

Configuration choices:
- **Style**: Default (or custom to match current theme)
- **Base color**: Neutral (closest to current grays)
- **CSS variables**: Yes
- **Components directory**: `src/components/ui`

### 1.4 Add Path Aliases
Update `vite.config.js`:
```js
resolve: {
  alias: {
    '@': '/src'
  }
}
```

Create/update `jsconfig.json` for IDE support.

---

## Phase 2: Install Required shadcn-vue Components

Based on the current UI patterns, install these components:

```bash
# Core components
npx shadcn-vue@latest add button
npx shadcn-vue@latest add input
npx shadcn-vue@latest add select
npx shadcn-vue@latest add checkbox
npx shadcn-vue@latest add slider
npx shadcn-vue@latest add badge

# Layout & Navigation
npx shadcn-vue@latest add tabs
npx shadcn-vue@latest add collapsible
npx shadcn-vue@latest add separator

# Overlays & Feedback
npx shadcn-vue@latest add dialog
npx shadcn-vue@latest add toast
npx shadcn-vue@latest add tooltip

# Data Display
npx shadcn-vue@latest add table
npx shadcn-vue@latest add pagination

# Form components
npx shadcn-vue@latest add calendar
npx shadcn-vue@latest add popover
npx shadcn-vue@latest add dropdown-menu
npx shadcn-vue@latest add command  # For combobox/autocomplete
```

---

## Phase 3: Component Migration (by file)

### 3.1 Sidebar.vue (2,163 lines → estimated ~1,400 lines)

| Current Pattern | shadcn-vue Replacement | Lines Saved |
|----------------|----------------------|-------------|
| View toggle buttons | `<Tabs>` | ~30 lines |
| Collapsible filter sections | `<Collapsible>` | ~100 lines |
| Status checkboxes | `<Checkbox>` | ~50 lines |
| Point size/opacity sliders | `<Slider>` | ~40 lines |
| Export aspect ratio select | `<Select>` | ~20 lines |
| Custom buttons | `<Button>` variant props | ~80 lines |
| Toast notification | `<Toast>` via `useToast()` | ~30 lines |
| CAMID autocomplete | `<Command>` (combobox) | ~150 lines |

**Key changes:**
- Replace custom `<button>` with `<Button variant="outline" size="sm">`
- Replace collapsible sections with `<Collapsible>` + `<CollapsibleTrigger>` + `<CollapsibleContent>`
- Replace status filter checkboxes with `<Checkbox>` + `<Label>`
- Replace `<input type="range">` with `<Slider>`
- Remove ~500 lines of scoped CSS

### 3.2 FilterSelect.vue (227 lines → ~50 lines or DELETE)

**Option A:** Replace `vue-multiselect` with shadcn-vue `<Command>` (combobox pattern)
- Better accessibility
- Consistent styling
- Remove `vue-multiselect` dependency

**Option B:** Keep as thin wrapper but restyle with Tailwind classes

### 3.3 DateFilter.vue (411 lines → ~150 lines)

| Current Pattern | shadcn-vue Replacement |
|----------------|----------------------|
| Custom date inputs | `<Popover>` + `<Calendar>` |
| Quick range buttons | `<Button variant="outline" size="sm">` |
| Clear button | `<Button variant="ghost">` |

**Benefits:**
- Proper date picker UI instead of text inputs
- Built-in keyboard navigation
- Range selection support

### 3.4 DataTable.vue (816 lines → ~400 lines)

| Current Pattern | shadcn-vue Replacement |
|----------------|----------------------|
| `<table>` with custom CSS | `<Table>` + `<TableHeader>` + `<TableBody>` + `<TableRow>` + `<TableCell>` |
| Custom pagination | `<Pagination>` |
| Column dropdown | `<DropdownMenu>` |
| Page size select | `<Select>` |
| Status badges | `<Badge variant="...">` |

**Key changes:**
```vue
<!-- Before -->
<table class="data-table">
  <thead><tr><th>...</th></tr></thead>
  <tbody><tr><td>...</td></tr></tbody>
</table>

<!-- After -->
<Table>
  <TableHeader>
    <TableRow><TableHead>...</TableHead></TableRow>
  </TableHeader>
  <TableBody>
    <TableRow><TableCell>...</TableCell></TableRow>
  </TableBody>
</Table>
```

### 3.5 ExportPanel.vue (1,422 lines → ~900 lines)

| Current Pattern | shadcn-vue Replacement |
|----------------|----------------------|
| Modal overlay | `<Dialog>` + `<DialogContent>` |
| Close button | `<DialogClose>` or `<Button variant="ghost">` |
| Export buttons | `<Button>` with variants |
| Citation tabs | `<Tabs>` |
| Success toast | `useToast()` |

### 3.6 MapExport.vue (749 lines → ~500 lines)

Same pattern as ExportPanel - wrap in `<Dialog>`.

### 3.7 MimicrySelector.vue (1,217 lines → ~800 lines)

| Current Pattern | shadcn-vue Replacement |
|----------------|----------------------|
| Full-screen modal | `<Dialog>` with custom size |
| Search input | `<Input>` |
| Selection checkboxes | `<Checkbox>` |
| Action buttons | `<Button>` |

### 3.8 ImageGallery.vue (1,904 lines → ~1,400 lines)

| Current Pattern | shadcn-vue Replacement |
|----------------|----------------------|
| Gallery modal | `<Dialog>` (full-screen variant) |
| Filter inputs | `<Input>`, `<Select>` |
| Thumbnail grid | Keep custom (domain-specific) |
| Navigation buttons | `<Button variant="ghost">` |

### 3.9 PointPopup.vue (820 lines → ~600 lines)

- Keep MapLibre popup rendering (domain-specific)
- Replace internal buttons with shadcn `<Button>`
- Use `<Badge>` for status display

### 3.10 App.vue (328 lines → ~280 lines)

- Main layout stays mostly the same
- Wrap sidebar toggle with proper `<Button>`

---

## Phase 4: Theme Customization

### 4.1 Map Current Theme to shadcn CSS Variables

Create `src/index.css` with dark theme:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Keep light theme for potential future use */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... */
  }

  .dark {
    /* Current dark scientific theme */
    --background: 235 33% 14%;           /* #1a1a2e */
    --foreground: 0 0% 88%;              /* #e0e0e0 */
    --card: 240 25% 20%;                 /* #252540 */
    --card-foreground: 0 0% 88%;
    --popover: 240 25% 20%;
    --popover-foreground: 0 0% 88%;
    --primary: 142 69% 58%;              /* #4ade80 green accent */
    --primary-foreground: 235 33% 14%;
    --secondary: 246 22% 27%;            /* #2d2d4a */
    --secondary-foreground: 0 0% 88%;
    --muted: 240 20% 25%;
    --muted-foreground: 0 0% 67%;        /* #aaa */
    --accent: 142 69% 58%;
    --accent-foreground: 235 33% 14%;
    --destructive: 0 84% 60%;            /* #ef4444 */
    --destructive-foreground: 0 0% 98%;
    --border: 246 22% 30%;               /* #3d3d5c */
    --input: 246 22% 30%;
    --ring: 142 69% 58%;
    --radius: 0.375rem;                  /* 6px - current --radius-md */
  }
}

/* Force dark mode */
html {
  color-scheme: dark;
}
```

### 4.2 Status Badge Variants

Create custom badge variants for sequencing status:

```css
/* In index.css or a custom variants file */
.badge-sequenced { --badge-bg: #3b82f6; }
.badge-tissue { --badge-bg: #10b981; }
.badge-preserved { --badge-bg: #f59e0b; }
.badge-published { --badge-bg: #a855f7; }
.badge-gbif { --badge-bg: #6b7280; }
```

---

## Phase 5: Remove Legacy Code

### 5.1 Remove vue-multiselect
```bash
npm uninstall vue-multiselect
```

### 5.2 Clean up style.css
- Remove component-specific styles (moved to Tailwind)
- Keep only:
  - CSS reset (Tailwind preflight handles this)
  - MapLibre GL overrides
  - Print styles
  - Animation keyframes (if not using Tailwind animations)

### 5.3 Delete FilterSelect.vue
If fully replaced by shadcn `<Command>` or `<Select>`.

---

## Phase 6: Estimated Code Reduction

| File | Before (lines) | After (estimated) | Reduction |
|------|---------------|-------------------|-----------|
| Sidebar.vue | 2,163 | 1,400 | -35% |
| FilterSelect.vue | 227 | 0 (deleted) | -100% |
| DateFilter.vue | 411 | 150 | -64% |
| DataTable.vue | 816 | 400 | -51% |
| ExportPanel.vue | 1,422 | 900 | -37% |
| MapExport.vue | 749 | 500 | -33% |
| MimicrySelector.vue | 1,217 | 800 | -34% |
| ImageGallery.vue | 1,904 | 1,400 | -26% |
| PointPopup.vue | 820 | 600 | -27% |
| App.vue | 328 | 280 | -15% |
| style.css | 261 | 80 | -69% |
| **TOTAL** | **10,318** | **~6,510** | **~37%** |

---

## Phase 7: Implementation Order (Recommended)

1. **Foundation** (Phase 1) - ~2 hours
   - Install Tailwind + shadcn-vue
   - Configure theme
   - Test that existing app still works

2. **Low-risk components first**
   - `Button` - used everywhere, easy wins
   - `Badge` - simple replacement for status dots
   - `Checkbox` - form elements

3. **Form components**
   - `Input`, `Select`, `Slider`
   - `DateFilter.vue` migration

4. **Data display**
   - `Table` for DataTable.vue
   - `Pagination`

5. **Overlays (higher risk)**
   - `Dialog` for modals
   - `Toast` for notifications

6. **Complex components last**
   - FilterSelect → Command (combobox)
   - Sidebar collapsibles

---

## Dependencies to Add

```json
{
  "dependencies": {
    "tailwindcss": "^4.x",
    "reka-ui": "^2.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.x"
  }
}
```

**Remove:**
```json
{
  "dependencies": {
    "vue-multiselect": "^3.1.0"  // Remove after migration
  }
}
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tailwind conflicts with existing CSS | Use `@layer` directives, migrate incrementally |
| Bundle size increase | Tree-shaking works well with shadcn; only import used components |
| MapLibre styling conflicts | Keep MapLibre overrides in separate CSS file |
| Breaking existing functionality | Migrate one component at a time, test after each |

---

## Success Metrics

- [ ] All modals use `<Dialog>` component
- [ ] All buttons use `<Button>` component
- [ ] All form inputs use shadcn equivalents
- [ ] DataTable uses `<Table>` + `<Pagination>`
- [ ] vue-multiselect removed from dependencies
- [ ] style.css reduced to <100 lines
- [ ] Total component code reduced by >30%
- [ ] Accessibility audit passes (keyboard navigation, ARIA)

---

## References

- [shadcn-vue Documentation](https://www.shadcn-vue.com/docs)
- [shadcn-vue Components](https://www.shadcn-vue.com/docs/components)
- [Reka UI (underlying primitives)](https://reka-ui.com/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
