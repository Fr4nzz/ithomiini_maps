# Ithomiini Maps - shadcn-vue UI Enhancement Plan

## Overview

This plan enhances the existing Vue 3 application with shadcn-vue components and Tailwind CSS v4 theming **without** migrating to React. This preserves all existing functionality (data loading, map rendering, filtering) while upgrading the UI components and implementing a robust theme system.

## Why This Approach?

### Lessons from React Migration Attempt
1. **Data loading broke** - The React migration introduced issues with the data loading mechanism
2. **Unnecessary complexity** - Migrating state management (Pinia → Zustand) and component logic introduced bugs
3. **High risk** - Full framework migration has many failure points

### Benefits of shadcn-vue Enhancement
1. **Preserves working code** - Existing MapLibre integration, data stores, and utilities remain intact
2. **Incremental adoption** - Components can be replaced one at a time
3. **Same design language** - shadcn-vue uses identical CSS variables and theming as shadcn/ui
4. **Lower risk** - If a component doesn't work, we can keep the old one

## Prerequisites

- Node.js 18+
- pnpm (already in use)
- Vue 3.5+ (current: 3.5.24 ✓)
- Vite 7+ (current: 7.2.4 ✓)

## Phase 1: Foundation Setup

### 1.1 Install Tailwind CSS v4

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

### 1.2 Configure Vite for Tailwind v4

Update `vite.config.js` → `vite.config.ts`:

```typescript
import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 1.3 Add TypeScript Configuration

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```

### 1.4 Initialize shadcn-vue

```bash
npx shadcn-vue@latest init
```

Configuration choices:
- Style: Default
- Base color: Neutral (we'll customize with our 5 themes)
- CSS variables: Yes
- Tailwind config location: (use defaults for v4)
- Components location: `@/components/ui`
- Utils location: `@/lib/utils`

## Phase 2: Theme System Implementation

### 2.1 Create Theme CSS Variables

The existing app has 5 themes: dark, light, ocean, forest, sunset. We need to map these to shadcn-vue's CSS variable system.

Create/update `src/assets/themes.css`:

```css
@import "tailwindcss";

/* Register custom theme variables for Tailwind v4 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* ═══════════════════════════════════════════════════════════════════
   THEME: DARK (Default - Scientific Dark)
   ═══════════════════════════════════════════════════════════════════ */
:root, [data-theme="dark"] {
  --background: 240 10% 9%;
  --foreground: 0 0% 88%;
  --card: 240 10% 14%;
  --card-foreground: 0 0% 88%;
  --popover: 240 10% 12%;
  --popover-foreground: 0 0% 88%;
  --primary: 142 71% 45%;
  --primary-foreground: 240 10% 9%;
  --secondary: 240 10% 20%;
  --secondary-foreground: 0 0% 88%;
  --muted: 240 10% 20%;
  --muted-foreground: 0 0% 64%;
  --accent: 142 71% 45%;
  --accent-foreground: 240 10% 9%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 10% 25%;
  --input: 240 10% 25%;
  --ring: 142 71% 45%;
  --radius: 0.5rem;

  /* Legacy variables for existing components */
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #252540;
  --color-bg-tertiary: #2d2d4a;
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #aaa;
  --color-accent: #4ade80;
}

/* ═══════════════════════════════════════════════════════════════════
   THEME: LIGHT
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="light"] {
  --background: 0 0% 100%;
  --foreground: 240 10% 10%;
  --card: 0 0% 98%;
  --card-foreground: 240 10% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 10%;
  --primary: 142 71% 35%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 5% 92%;
  --secondary-foreground: 240 10% 10%;
  --muted: 240 5% 96%;
  --muted-foreground: 240 5% 40%;
  --accent: 142 71% 35%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 84% 50%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 5% 85%;
  --input: 240 5% 85%;
  --ring: 142 71% 35%;

  /* Legacy variables */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f7;
  --color-bg-tertiary: #eaeaed;
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #555;
  --color-accent: #16a34a;
}

/* ═══════════════════════════════════════════════════════════════════
   THEME: OCEAN
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="ocean"] {
  --background: 210 50% 10%;
  --foreground: 200 30% 90%;
  --card: 210 50% 15%;
  --card-foreground: 200 30% 90%;
  --popover: 210 50% 12%;
  --popover-foreground: 200 30% 90%;
  --primary: 190 90% 50%;
  --primary-foreground: 210 50% 10%;
  --secondary: 210 50% 20%;
  --secondary-foreground: 200 30% 90%;
  --muted: 210 50% 20%;
  --muted-foreground: 200 30% 60%;
  --accent: 190 90% 50%;
  --accent-foreground: 210 50% 10%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 210 40% 25%;
  --input: 210 40% 25%;
  --ring: 190 90% 50%;

  /* Legacy variables */
  --color-bg-primary: #0d1b2a;
  --color-bg-secondary: #1b2838;
  --color-bg-tertiary: #253545;
  --color-text-primary: #d0e8f2;
  --color-text-secondary: #8ab4c4;
  --color-accent: #00d4ff;
}

/* ═══════════════════════════════════════════════════════════════════
   THEME: FOREST
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="forest"] {
  --background: 150 30% 8%;
  --foreground: 80 20% 88%;
  --card: 150 30% 12%;
  --card-foreground: 80 20% 88%;
  --popover: 150 30% 10%;
  --popover-foreground: 80 20% 88%;
  --primary: 85 60% 50%;
  --primary-foreground: 150 30% 8%;
  --secondary: 150 30% 18%;
  --secondary-foreground: 80 20% 88%;
  --muted: 150 30% 18%;
  --muted-foreground: 80 20% 55%;
  --accent: 85 60% 50%;
  --accent-foreground: 150 30% 8%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 150 25% 22%;
  --input: 150 25% 22%;
  --ring: 85 60% 50%;

  /* Legacy variables */
  --color-bg-primary: #1a2e1a;
  --color-bg-secondary: #243524;
  --color-bg-tertiary: #2e422e;
  --color-text-primary: #d4e0d4;
  --color-text-secondary: #98b498;
  --color-accent: #8bc34a;
}

/* ═══════════════════════════════════════════════════════════════════
   THEME: SUNSET
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="sunset"] {
  --background: 20 30% 10%;
  --foreground: 35 30% 90%;
  --card: 20 30% 14%;
  --card-foreground: 35 30% 90%;
  --popover: 20 30% 12%;
  --popover-foreground: 35 30% 90%;
  --primary: 25 95% 55%;
  --primary-foreground: 20 30% 10%;
  --secondary: 20 30% 20%;
  --secondary-foreground: 35 30% 90%;
  --muted: 20 30% 20%;
  --muted-foreground: 35 30% 55%;
  --accent: 25 95% 55%;
  --accent-foreground: 20 30% 10%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 20 25% 25%;
  --input: 20 25% 25%;
  --ring: 25 95% 55%;

  /* Legacy variables */
  --color-bg-primary: #2e1a1a;
  --color-bg-secondary: #3d2525;
  --color-bg-tertiary: #4a3030;
  --color-text-primary: #f0d4c4;
  --color-text-secondary: #c4a898;
  --color-accent: #ff7f50;
}
```

### 2.2 Update Theme Store

Modify `src/stores/theme.js` to set `data-theme` attribute on document:

```javascript
// In setTheme action, add:
document.documentElement.setAttribute('data-theme', themeName)
```

### 2.3 Theme Selector UI in Sidebar

The sidebar should include a dedicated **Theme Settings** section with:

#### 2.3.1 Quick Light/Dark Toggle

A simple switch at the top for quickly toggling between light and dark modes:

```vue
<template>
  <div class="flex items-center justify-between">
    <Label class="flex items-center gap-2">
      <Sun class="h-4 w-4" />
      <span>Light Mode</span>
    </Label>
    <Switch
      :checked="isLightMode"
      @update:checked="toggleLightDark"
    />
  </div>
</template>
```

#### 2.3.2 Theme Preset Dropdown

Below the toggle, a dropdown to select from all 5 theme presets:

```vue
<template>
  <div class="space-y-2">
    <Label>Theme Preset</Label>
    <Select v-model="currentTheme" @update:modelValue="setTheme">
      <SelectTrigger class="w-full">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="dark">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full bg-[#1a1a2e] border" />
            <span>Dark (Default)</span>
          </div>
        </SelectItem>
        <SelectItem value="light">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full bg-[#ffffff] border" />
            <span>Light</span>
          </div>
        </SelectItem>
        <SelectItem value="ocean">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full bg-[#0d1b2a] border" />
            <span>Ocean</span>
          </div>
        </SelectItem>
        <SelectItem value="forest">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full bg-[#1a2e1a] border" />
            <span>Forest</span>
          </div>
        </SelectItem>
        <SelectItem value="sunset">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full bg-[#2e1a1a] border" />
            <span>Sunset</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
```

#### 2.3.3 Sidebar Layout for Theme Section

The theme controls should be placed in a collapsible Accordion section within the sidebar:

```vue
<Accordion type="single" collapsible>
  <AccordionItem value="theme">
    <AccordionTrigger>
      <div class="flex items-center gap-2">
        <Palette class="h-4 w-4" />
        <span>Theme</span>
      </div>
    </AccordionTrigger>
    <AccordionContent class="space-y-4 pt-2">
      <!-- Light/Dark Toggle -->
      <div class="flex items-center justify-between">
        <Label class="flex items-center gap-2 text-sm">
          <Sun class="h-4 w-4" />
          Light Mode
        </Label>
        <Switch :checked="isLightMode" @update:checked="toggleLightDark" />
      </div>

      <Separator />

      <!-- Theme Preset Dropdown -->
      <div class="space-y-2">
        <Label class="text-sm">Theme Preset</Label>
        <Select v-model="currentTheme">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <!-- Theme options with color swatches -->
          </SelectContent>
        </Select>
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

#### 2.3.4 Theme Presets Definition

The 5 theme presets with the current "dark" theme as default:

| Theme | Description | Default |
|-------|-------------|---------|
| **dark** | Scientific dark theme with green accent | **Yes (Default)** |
| light | Clean light theme for daytime use | No |
| ocean | Deep blue theme inspired by ocean depths | No |
| forest | Natural green theme with earthy tones | No |
| sunset | Warm orange/coral theme | No |

The **dark** theme matches the current application colors exactly, ensuring existing users see no change until they choose to switch themes.

## Phase 3: Install shadcn-vue Components

Install components incrementally, testing after each:

```bash
# Core UI components
npx shadcn-vue@latest add button
npx shadcn-vue@latest add card
npx shadcn-vue@latest add dialog
npx shadcn-vue@latest add sheet
npx shadcn-vue@latest add popover
npx shadcn-vue@latest add dropdown-menu
npx shadcn-vue@latest add tabs
npx shadcn-vue@latest add accordion

# Form components
npx shadcn-vue@latest add select
npx shadcn-vue@latest add slider
npx shadcn-vue@latest add switch
npx shadcn-vue@latest add checkbox
npx shadcn-vue@latest add input
npx shadcn-vue@latest add label

# Data display
npx shadcn-vue@latest add badge
npx shadcn-vue@latest add table
npx shadcn-vue@latest add scroll-area
npx shadcn-vue@latest add separator
npx shadcn-vue@latest add tooltip
npx shadcn-vue@latest add skeleton

# Advanced components (if needed)
npx shadcn-vue@latest add command
npx shadcn-vue@latest add calendar
```

## Phase 4: Incremental Component Migration

### Priority Order (by impact and risk)

1. **ThemeSelector.vue** - Simple, isolated component
2. **Sidebar.vue** - Uses many UI elements, high visual impact
3. **FilterSelect.vue** - Replace vue-multiselect with shadcn Select/Combobox
4. **ExportPanel.vue** - Dialog-based, self-contained
5. **DataTable.vue** - Complex but isolated
6. **Legend/*.vue** - Keep mostly as-is, just update styling

### Migration Strategy for Each Component

For each component:
1. Create a new version using shadcn-vue components
2. Test thoroughly with existing store/data
3. If working, replace the old component
4. If issues, keep the old component and debug

### Example: Migrating FilterSelect.vue

Before (vue-multiselect):
```vue
<Multiselect
  v-model="selected"
  :options="options"
  :multiple="true"
  :searchable="true"
/>
```

After (shadcn-vue Command + Popover):
```vue
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" class="w-full justify-between">
      {{ selectedLabel }}
      <ChevronsUpDown class="ml-2 h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent class="w-full p-0">
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            v-for="option in options"
            :key="option.value"
            :value="option.value"
            @select="toggleOption(option)"
          >
            <Check :class="cn('mr-2 h-4 w-4', isSelected(option) ? 'opacity-100' : 'opacity-0')" />
            {{ option.label }}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

## Phase 5: Preserve Existing Functionality

### Critical Code to NOT Modify

1. **Data Loading** (`src/stores/data.js`)
   - `loadMapData()` function
   - GeoJSON processing
   - Filter logic

2. **Map Engine** (`src/components/MapEngine.vue`)
   - MapLibre initialization
   - Layer rendering
   - Popup handling

3. **Utility Functions** (`src/utils/`)
   - All color/shape generation
   - Cluster statistics
   - Canvas helpers

### Integration Points

The shadcn-vue components should:
- Use existing Pinia stores (no migration needed)
- Emit the same events as current components
- Accept the same props where possible

## Phase 6: Testing Checklist

After each phase, verify:

- [ ] Application loads without errors
- [ ] Map data loads and displays correctly
- [ ] Filters work (species, subspecies, source, status)
- [ ] Theme switching works
- [ ] Legend displays and is draggable
- [ ] Export panel opens and exports work
- [ ] Data table displays and is searchable/sortable
- [ ] All 5 themes render correctly

## Dependencies to Add

```bash
pnpm add -D tailwindcss @tailwindcss/vite typescript
pnpm add @vueuse/core  # Already present
pnpm add class-variance-authority clsx tailwind-merge
pnpm add reka-ui  # Core library for shadcn-vue v1
pnpm add lucide-vue-next  # Already present
```

## Dependencies to Remove (after migration)

```bash
pnpm remove vue-multiselect  # Replaced by shadcn Command/Select
```

## Risk Mitigation

1. **Backup before starting**: Create a backup branch
2. **Incremental commits**: Commit after each working change
3. **Feature flags**: Can keep old components alongside new ones
4. **Rollback plan**: Each phase is independently revertable

## Timeline Considerations

This plan focuses on **what** needs to be done, not **when**. The phases can be executed in order, with testing gates between each. If any phase introduces issues, stop and debug before proceeding.

## Key Differences from React Migration

| Aspect | React Migration | shadcn-vue Enhancement |
|--------|----------------|----------------------|
| Framework | Vue → React | Vue → Vue |
| State Management | Pinia → Zustand | Pinia (unchanged) |
| Map Library | maplibre → react-map-gl | maplibre (unchanged) |
| Risk Level | High | Low |
| Data Loading | Needs rewrite | Preserved |
| Component Logic | Full rewrite | Gradual update |

## References

- [shadcn-vue Documentation](https://www.shadcn-vue.com/docs/installation/vite)
- [shadcn-vue Theming](https://www.shadcn-vue.com/docs/theming)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Reka UI (shadcn-vue v1 core)](https://reka-ui.com/)

## Notes from Previous Attempt

1. **tweakcn is NOT a CLI registry** - It's a visual editor at tweakcn.com for creating themes. Don't try to install themes via `npx` from tweakcn URLs.

2. **Existing themes should be preserved** - The current 5 themes (dark, light, ocean, forest, sunset) in `src/themes/presets.js` should be converted to CSS variables, not replaced.

3. **CSS variable format** - shadcn uses HSL values without the `hsl()` wrapper: `--primary: 142 71% 45%` not `--primary: hsl(142, 71%, 45%)`
