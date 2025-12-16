# shadcn-vue Component Reference

> Complete documentation for all shadcn-vue components to be used in the Ithomiini Maps migration.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Theming & CSS Variables](#theming--css-variables)
3. [Form Components](#form-components)
   - [Button](#button)
   - [Input](#input)
   - [Textarea](#textarea)
   - [Select](#select)
   - [Checkbox](#checkbox)
   - [Switch](#switch)
   - [Slider](#slider)
   - [Label](#label)
4. [Data Display](#data-display)
   - [Badge](#badge)
   - [Table](#table)
   - [Card](#card)
   - [Avatar](#avatar)
   - [Skeleton](#skeleton)
   - [Progress](#progress)
5. [Layout & Navigation](#layout--navigation)
   - [Tabs](#tabs)
   - [Accordion](#accordion)
   - [Collapsible](#collapsible)
   - [Separator](#separator)
6. [Overlays & Modals](#overlays--modals)
   - [Dialog](#dialog)
   - [Alert Dialog](#alert-dialog)
   - [Sheet](#sheet)
   - [Popover](#popover)
   - [Tooltip](#tooltip)
7. [Menus & Commands](#menus--commands)
   - [Command (Combobox)](#command-combobox)
   - [Context Menu](#context-menu)
   - [Dropdown Menu](#dropdown-menu)
8. [Feedback](#feedback)
   - [Sonner (Toast)](#sonner-toast)
9. [Navigation](#navigation)
   - [Pagination](#pagination)
10. [Interactive](#interactive)
    - [Toggle](#toggle)
    - [Toggle Group](#toggle-group)

---

## Installation & Setup

### Prerequisites

- Vue 3.4+
- Vite
- Node.js 18+

### Step 1: Install Tailwind CSS 4

```bash
npm install tailwindcss @tailwindcss/vite
```

Update `vite.config.js`:

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

### Step 2: Initialize shadcn-vue

```bash
npx shadcn-vue@latest init
```

Configuration prompts:
- **Style**: Default
- **Base color**: Neutral
- **CSS variables**: Yes
- **Global CSS file**: `src/index.css`
- **Components directory**: `src/components/ui`

### Step 3: Install Components

```bash
# Install all components we need at once
npx shadcn-vue@latest add button input textarea select checkbox switch slider label badge table card avatar skeleton progress tabs accordion collapsible separator dialog alert-dialog sheet popover tooltip command context-menu sonner pagination toggle
```

### Step 4: Update Main Entry

In `src/main.js`:

```js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './index.css'  // Tailwind + shadcn styles

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

---

## Theming & CSS Variables

### Color Convention

shadcn-vue uses a "background and foreground" pattern:

| Variable | Background Class | Text Class |
|----------|-----------------|------------|
| `--primary` | `bg-primary` | `text-primary-foreground` |
| `--secondary` | `bg-secondary` | `text-secondary-foreground` |
| `--muted` | `bg-muted` | `text-muted-foreground` |
| `--accent` | `bg-accent` | `text-accent-foreground` |
| `--destructive` | `bg-destructive` | `text-destructive-foreground` |

### Dark Theme Configuration (for Ithomiini Maps)

Create/update `src/index.css`:

```css
@import "tailwindcss";

@layer base {
  :root {
    /* Light theme (fallback) */
    --background: 0 0% 100%;
    --foreground: 235 33% 14%;
    --card: 0 0% 100%;
    --card-foreground: 235 33% 14%;
    --popover: 0 0% 100%;
    --popover-foreground: 235 33% 14%;
    --primary: 142 69% 58%;
    --primary-foreground: 235 33% 14%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 235 33% 14%;
    --muted: 240 5% 96%;
    --muted-foreground: 0 0% 45%;
    --accent: 142 69% 58%;
    --accent-foreground: 235 33% 14%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 6% 90%;
    --input: 240 6% 90%;
    --ring: 142 69% 58%;
    --radius: 0.375rem;
  }

  .dark {
    /* Ithomiini Maps Dark Scientific Theme */
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
  }
}

/* Force dark mode */
html {
  color-scheme: dark;
}

body {
  @apply bg-background text-foreground;
}
```

### Custom Status Colors (Sequencing)

Add these custom CSS variables for status badges:

```css
@layer base {
  :root, .dark {
    /* Sequencing status colors */
    --status-sequenced: 217 91% 60%;     /* #3b82f6 blue */
    --status-tissue: 160 84% 39%;        /* #10b981 green */
    --status-preserved: 38 92% 50%;      /* #f59e0b orange */
    --status-published: 271 81% 56%;     /* #a855f7 purple */
    --status-gbif: 220 9% 46%;           /* #6b7280 gray */
    --status-observation: 142 71% 45%;   /* #22c55e green */
    --status-museum: 258 90% 66%;        /* #8b5cf6 purple */
    --status-living: 173 80% 40%;        /* #14b8a6 teal */
  }
}
```

---

## Form Components

### Button

A versatile button component with multiple variants and sizes.

**Installation:**
```bash
npx shadcn-vue@latest add button
```

**Import:**
```vue
<script setup>
import { Button } from '@/components/ui/button'
</script>
```

**Variants:**
| Variant | Description |
|---------|-------------|
| `default` | Primary button style with solid background |
| `secondary` | Secondary/muted button |
| `outline` | Border-only button |
| `ghost` | Minimal, no background until hover |
| `destructive` | Red/danger button |
| `link` | Styled as a text link |

**Sizes:**
| Size | Description |
|------|-------------|
| `sm` | Small button |
| `default` | Standard size |
| `lg` | Large button |
| `icon` | Square button for icons |
| `icon-sm` | Small icon button |
| `icon-lg` | Large icon button |

**Usage Examples:**

```vue
<template>
  <!-- Basic variants -->
  <Button>Default</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="link">Link</Button>

  <!-- Sizes -->
  <Button size="sm">Small</Button>
  <Button size="lg">Large</Button>

  <!-- With icon -->
  <Button>
    <svg class="mr-2 h-4 w-4">...</svg>
    With Icon
  </Button>

  <!-- Icon only -->
  <Button variant="outline" size="icon">
    <svg class="h-4 w-4">...</svg>
  </Button>

  <!-- Disabled -->
  <Button disabled>Disabled</Button>

  <!-- Loading state (with Spinner) -->
  <Button disabled>
    <Spinner class="mr-2" />
    Loading...
  </Button>

  <!-- As link -->
  <Button as-child>
    <a href="/page">Navigate</a>
  </Button>
</template>
```

**Migration from custom buttons:**
```vue
<!-- Before (custom) -->
<button class="action-btn" @click="handleClick">
  <svg>...</svg>
  Action
</button>

<!-- After (shadcn) -->
<Button variant="outline" size="sm" @click="handleClick">
  <svg class="mr-2 h-4 w-4">...</svg>
  Action
</Button>
```

---

### Input

Text input field with consistent styling.

**Installation:**
```bash
npx shadcn-vue@latest add input
```

**Import:**
```vue
<script setup>
import { Input } from '@/components/ui/input'
</script>
```

**Usage:**

```vue
<template>
  <!-- Basic input -->
  <Input type="text" placeholder="Enter value..." />

  <!-- With v-model -->
  <Input v-model="searchQuery" placeholder="Search..." />

  <!-- Different types -->
  <Input type="email" placeholder="Email" />
  <Input type="password" placeholder="Password" />
  <Input type="number" placeholder="0" />

  <!-- Disabled -->
  <Input disabled placeholder="Disabled" />

  <!-- With label -->
  <div class="grid gap-2">
    <Label for="email">Email</Label>
    <Input id="email" type="email" placeholder="m@example.com" />
  </div>

  <!-- File input -->
  <Input type="file" />
</template>
```

**Migration:**
```vue
<!-- Before -->
<input
  type="text"
  class="setting-input"
  v-model="value"
  placeholder="Search..."
/>

<!-- After -->
<Input v-model="value" placeholder="Search..." />
```

---

### Textarea

Multi-line text input.

**Installation:**
```bash
npx shadcn-vue@latest add textarea
```

**Import:**
```vue
<script setup>
import { Textarea } from '@/components/ui/textarea'
</script>
```

**Usage:**

```vue
<template>
  <!-- Basic -->
  <Textarea placeholder="Type your message here." />

  <!-- With v-model -->
  <Textarea v-model="message" />

  <!-- Disabled -->
  <Textarea disabled placeholder="Disabled" />

  <!-- With label -->
  <div class="grid gap-2">
    <Label for="message">Your Message</Label>
    <Textarea id="message" placeholder="Type here..." />
  </div>
</template>
```

---

### Select

Dropdown selection component.

**Installation:**
```bash
npx shadcn-vue@latest add select
```

**Import:**
```vue
<script setup>
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Select` | Root wrapper |
| `SelectTrigger` | Button that opens dropdown |
| `SelectValue` | Displays selected value |
| `SelectContent` | Dropdown container |
| `SelectGroup` | Groups related items |
| `SelectLabel` | Label for a group |
| `SelectItem` | Individual option |

**Usage:**

```vue
<template>
  <!-- Basic select -->
  <Select v-model="selected">
    <SelectTrigger class="w-[180px]">
      <SelectValue placeholder="Select option" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="option1">Option 1</SelectItem>
      <SelectItem value="option2">Option 2</SelectItem>
      <SelectItem value="option3">Option 3</SelectItem>
    </SelectContent>
  </Select>

  <!-- With groups -->
  <Select>
    <SelectTrigger class="w-[200px]">
      <SelectValue placeholder="Select a fruit" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Fruits</SelectLabel>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
      </SelectGroup>
      <SelectGroup>
        <SelectLabel>Vegetables</SelectLabel>
        <SelectItem value="carrot">Carrot</SelectItem>
        <SelectItem value="potato">Potato</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>

  <!-- Multiple selection -->
  <Select multiple>
    <SelectTrigger class="w-[200px]">
      <SelectValue placeholder="Select items" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="item1">Item 1</SelectItem>
      <SelectItem value="item2">Item 2</SelectItem>
    </SelectContent>
  </Select>
</template>
```

**Migration from native select:**
```vue
<!-- Before -->
<select v-model="aspectRatio" class="style-select">
  <option value="16:9">16:9 (Widescreen)</option>
  <option value="4:3">4:3 (Standard)</option>
</select>

<!-- After -->
<Select v-model="aspectRatio">
  <SelectTrigger class="w-[180px]">
    <SelectValue placeholder="Aspect Ratio" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
  </SelectContent>
</Select>
```

---

### Checkbox

Toggle checkbox with accessible styling.

**Installation:**
```bash
npx shadcn-vue@latest add checkbox
```

**Import:**
```vue
<script setup>
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
</script>
```

**Usage:**

```vue
<template>
  <!-- Basic checkbox -->
  <Checkbox id="terms" />

  <!-- With label -->
  <div class="flex items-center space-x-2">
    <Checkbox id="terms" v-model:checked="accepted" />
    <Label for="terms">Accept terms and conditions</Label>
  </div>

  <!-- Default checked -->
  <Checkbox :default-checked="true" />

  <!-- Disabled -->
  <Checkbox disabled />

  <!-- With description -->
  <div class="items-top flex space-x-2">
    <Checkbox id="terms" />
    <div class="grid gap-1.5 leading-none">
      <Label for="terms">Accept terms</Label>
      <p class="text-sm text-muted-foreground">
        You agree to our Terms of Service.
      </p>
    </div>
  </div>
</template>
```

**Migration:**
```vue
<!-- Before -->
<label class="checkbox-label">
  <input type="checkbox" v-model="includeLegend" />
  <span>Include Legend</span>
</label>

<!-- After -->
<div class="flex items-center space-x-2">
  <Checkbox id="legend" v-model:checked="includeLegend" />
  <Label for="legend">Include Legend</Label>
</div>
```

---

### Switch

Toggle switch for on/off states.

**Installation:**
```bash
npx shadcn-vue@latest add switch
```

**Import:**
```vue
<script setup>
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
</script>
```

**Usage:**

```vue
<template>
  <!-- Basic switch -->
  <Switch />

  <!-- With v-model -->
  <Switch v-model:checked="enabled" />

  <!-- With label -->
  <div class="flex items-center space-x-2">
    <Switch id="clustering" v-model:checked="clusteringEnabled" />
    <Label for="clustering">Enable Clustering</Label>
  </div>

  <!-- Disabled -->
  <Switch disabled />
</template>
```

---

### Slider

Range slider for numeric values.

**Installation:**
```bash
npx shadcn-vue@latest add slider
```

**Import:**
```vue
<script setup>
import { Slider } from '@/components/ui/slider'
</script>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `default-value` | `number[]` | Initial value(s) |
| `max` | `number` | Maximum value |
| `min` | `number` | Minimum value (default: 0) |
| `step` | `number` | Step increment |
| `disabled` | `boolean` | Disable interaction |

**Usage:**

```vue
<template>
  <!-- Basic slider -->
  <Slider :default-value="[50]" :max="100" :step="1" />

  <!-- With v-model -->
  <Slider v-model="opacity" :max="100" :step="1" class="w-[200px]" />

  <!-- Range slider (two handles) -->
  <Slider :default-value="[25, 75]" :max="100" />

  <!-- Custom range -->
  <Slider :default-value="[5]" :min="1" :max="20" :step="1" />
</template>

<script setup>
import { ref } from 'vue'
const opacity = ref([80])
</script>
```

**Migration:**
```vue
<!-- Before -->
<input
  type="range"
  v-model="pointSize"
  min="1"
  max="20"
  step="1"
  class="range-slider"
/>

<!-- After -->
<Slider
  v-model="pointSize"
  :min="1"
  :max="20"
  :step="1"
  class="w-[200px]"
/>
```

---

### Label

Accessible label for form controls.

**Installation:**
```bash
npx shadcn-vue@latest add label
```

**Import:**
```vue
<script setup>
import { Label } from '@/components/ui/label'
</script>
```

**Usage:**

```vue
<template>
  <!-- Basic label -->
  <Label for="email">Email</Label>
  <Input id="email" type="email" />

  <!-- With checkbox -->
  <div class="flex items-center space-x-2">
    <Checkbox id="terms" />
    <Label for="terms">Accept terms</Label>
  </div>

  <!-- With hint text -->
  <div class="grid gap-1.5">
    <Label for="width">Width</Label>
    <Input id="width" type="number" />
    <p class="text-sm text-muted-foreground">Enter width in pixels</p>
  </div>
</template>
```

---

## Data Display

### Badge

Small status indicator or label.

**Installation:**
```bash
npx shadcn-vue@latest add badge
```

**Import:**
```vue
<script setup>
import { Badge } from '@/components/ui/badge'
</script>
```

**Variants:**
| Variant | Description |
|---------|-------------|
| `default` | Primary badge |
| `secondary` | Muted/gray badge |
| `outline` | Border-only badge |
| `destructive` | Red/error badge |

**Usage:**

```vue
<template>
  <!-- Basic variants -->
  <Badge>Default</Badge>
  <Badge variant="secondary">Secondary</Badge>
  <Badge variant="outline">Outline</Badge>
  <Badge variant="destructive">Error</Badge>

  <!-- As link -->
  <Badge as-child>
    <a href="/status">View Status</a>
  </Badge>

  <!-- With custom colors (for sequencing status) -->
  <Badge class="bg-blue-500 text-white">Sequenced</Badge>
  <Badge class="bg-emerald-500 text-white">Tissue Available</Badge>
  <Badge class="bg-amber-500 text-white">Preserved Specimen</Badge>
  <Badge class="bg-purple-500 text-white">Published</Badge>
  <Badge class="bg-gray-500 text-white">GBIF Record</Badge>
</template>
```

**Migration:**
```vue
<!-- Before -->
<span
  class="status-badge"
  :style="{ backgroundColor: getStatusColor(status) }"
>
  {{ status }}
</span>

<!-- After -->
<Badge :class="getStatusBadgeClass(status)">
  {{ status }}
</Badge>
```

---

### Table

Data table with header, body, and footer.

**Installation:**
```bash
npx shadcn-vue@latest add table
```

**Import:**
```vue
<script setup>
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Table` | Root table element |
| `TableCaption` | Table caption/title |
| `TableHeader` | Header section (`<thead>`) |
| `TableBody` | Body section (`<tbody>`) |
| `TableFooter` | Footer section (`<tfoot>`) |
| `TableRow` | Table row (`<tr>`) |
| `TableHead` | Header cell (`<th>`) |
| `TableCell` | Body cell (`<td>`) |

**Usage:**

```vue
<template>
  <Table>
    <TableCaption>A list of records</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[100px]">ID</TableHead>
        <TableHead>Species</TableHead>
        <TableHead>Status</TableHead>
        <TableHead class="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="item in data" :key="item.id">
        <TableCell class="font-medium">{{ item.id }}</TableCell>
        <TableCell>{{ item.species }}</TableCell>
        <TableCell>
          <Badge>{{ item.status }}</Badge>
        </TableCell>
        <TableCell class="text-right">
          <Button variant="ghost" size="sm">View</Button>
        </TableCell>
      </TableRow>
    </TableBody>
    <TableFooter>
      <TableRow>
        <TableCell colspan="3">Total</TableCell>
        <TableCell class="text-right">{{ data.length }} records</TableCell>
      </TableRow>
    </TableFooter>
  </Table>
</template>
```

**Migration:**
```vue
<!-- Before -->
<table class="data-table">
  <thead>
    <tr>
      <th>Species</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="item in data" :key="item.id">
      <td>{{ item.species }}</td>
      <td>{{ item.status }}</td>
    </tr>
  </tbody>
</table>

<!-- After -->
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Species</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow v-for="item in data" :key="item.id">
      <TableCell>{{ item.species }}</TableCell>
      <TableCell>{{ item.status }}</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### Card

Container for grouped content.

**Installation:**
```bash
npx shadcn-vue@latest add card
```

**Import:**
```vue
<script setup>
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Card` | Root container |
| `CardHeader` | Header section |
| `CardTitle` | Title text |
| `CardDescription` | Subtitle/description |
| `CardContent` | Main content area |
| `CardFooter` | Footer with actions |

**Usage:**

```vue
<template>
  <Card class="w-[350px]">
    <CardHeader>
      <CardTitle>Export Data</CardTitle>
      <CardDescription>Download your filtered data</CardDescription>
    </CardHeader>
    <CardContent>
      <p>{{ recordCount }} records will be exported.</p>
    </CardContent>
    <CardFooter class="flex justify-between">
      <Button variant="outline">Cancel</Button>
      <Button>Export</Button>
    </CardFooter>
  </Card>
</template>
```

---

### Avatar

User avatar with image and fallback.

**Installation:**
```bash
npx shadcn-vue@latest add avatar
```

**Import:**
```vue
<script setup>
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
</script>
```

**Usage:**

```vue
<template>
  <!-- With image -->
  <Avatar>
    <AvatarImage src="https://example.com/avatar.jpg" alt="User" />
    <AvatarFallback>JD</AvatarFallback>
  </Avatar>

  <!-- Fallback only -->
  <Avatar>
    <AvatarFallback>CN</AvatarFallback>
  </Avatar>

  <!-- Different sizes -->
  <Avatar class="h-8 w-8">
    <AvatarImage src="..." />
    <AvatarFallback>SM</AvatarFallback>
  </Avatar>

  <Avatar class="h-16 w-16">
    <AvatarImage src="..." />
    <AvatarFallback>LG</AvatarFallback>
  </Avatar>
</template>
```

---

### Skeleton

Loading placeholder.

**Installation:**
```bash
npx shadcn-vue@latest add skeleton
```

**Import:**
```vue
<script setup>
import { Skeleton } from '@/components/ui/skeleton'
</script>
```

**Usage:**

```vue
<template>
  <!-- Simple placeholder -->
  <Skeleton class="h-4 w-[200px]" />

  <!-- Card loading state -->
  <div class="flex items-center space-x-4">
    <Skeleton class="h-12 w-12 rounded-full" />
    <div class="space-y-2">
      <Skeleton class="h-4 w-[250px]" />
      <Skeleton class="h-4 w-[200px]" />
    </div>
  </div>

  <!-- Table row skeleton -->
  <div class="space-y-2">
    <Skeleton class="h-8 w-full" />
    <Skeleton class="h-8 w-full" />
    <Skeleton class="h-8 w-full" />
  </div>
</template>
```

---

### Progress

Progress bar indicator.

**Installation:**
```bash
npx shadcn-vue@latest add progress
```

**Import:**
```vue
<script setup>
import { Progress } from '@/components/ui/progress'
</script>
```

**Usage:**

```vue
<template>
  <!-- Static progress -->
  <Progress :model-value="33" />

  <!-- Dynamic progress -->
  <Progress :model-value="exportProgress" class="w-full" />

  <!-- With percentage label -->
  <div class="space-y-2">
    <Progress :model-value="progress" />
    <p class="text-sm text-muted-foreground">{{ progress }}% complete</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const progress = ref(45)
</script>
```

---

## Layout & Navigation

### Tabs

Tab navigation component.

**Installation:**
```bash
npx shadcn-vue@latest add tabs
```

**Import:**
```vue
<script setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Tabs` | Root container |
| `TabsList` | Container for tab buttons |
| `TabsTrigger` | Individual tab button |
| `TabsContent` | Content panel for each tab |

**Usage:**

```vue
<template>
  <Tabs default-value="map" class="w-full">
    <TabsList>
      <TabsTrigger value="map">
        <svg class="mr-2 h-4 w-4">...</svg>
        Map
      </TabsTrigger>
      <TabsTrigger value="table">
        <svg class="mr-2 h-4 w-4">...</svg>
        Table
      </TabsTrigger>
    </TabsList>
    <TabsContent value="map">
      <MapEngine />
    </TabsContent>
    <TabsContent value="table">
      <DataTable />
    </TabsContent>
  </Tabs>
</template>
```

**Migration (view toggle):**
```vue
<!-- Before -->
<div class="view-toggle">
  <button :class="{ active: currentView === 'map' }" @click="setView('map')">
    Map
  </button>
  <button :class="{ active: currentView === 'table' }" @click="setView('table')">
    Table
  </button>
</div>

<!-- After -->
<Tabs v-model="currentView">
  <TabsList>
    <TabsTrigger value="map">Map</TabsTrigger>
    <TabsTrigger value="table">Table</TabsTrigger>
  </TabsList>
</Tabs>
```

---

### Accordion

Expandable content sections (single item open at a time).

**Installation:**
```bash
npx shadcn-vue@latest add accordion
```

**Import:**
```vue
<script setup>
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
</script>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `type` | `"single"` \| `"multiple"` | Allow single or multiple open |
| `collapsible` | `boolean` | Allow closing all items |
| `default-value` | `string` | Initially open item |

**Usage:**

```vue
<template>
  <!-- Single item open at a time -->
  <Accordion type="single" collapsible>
    <AccordionItem value="filters">
      <AccordionTrigger>Filters</AccordionTrigger>
      <AccordionContent>
        <!-- Filter controls here -->
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="settings">
      <AccordionTrigger>Settings</AccordionTrigger>
      <AccordionContent>
        <!-- Settings controls here -->
      </AccordionContent>
    </AccordionItem>
  </Accordion>

  <!-- Multiple items can be open -->
  <Accordion type="multiple" :default-value="['filters']">
    <AccordionItem value="filters">
      <AccordionTrigger>Filters</AccordionTrigger>
      <AccordionContent>...</AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
```

---

### Collapsible

Simple expand/collapse container.

**Installation:**
```bash
npx shadcn-vue@latest add collapsible
```

**Import:**
```vue
<script setup>
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
</script>
```

**Usage:**

```vue
<template>
  <Collapsible v-model:open="isOpen">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold">Advanced Settings</h4>
      <CollapsibleTrigger as-child>
        <Button variant="ghost" size="sm">
          <svg class="h-4 w-4" :class="{ 'rotate-180': isOpen }">...</svg>
        </Button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent class="space-y-2">
      <!-- Expanded content here -->
      <div class="rounded-md border px-4 py-3">
        <p>Advanced option 1</p>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup>
import { ref } from 'vue'
const isOpen = ref(false)
</script>
```

**Migration:**
```vue
<!-- Before -->
<div class="filter-section">
  <button @click="showAdvanced = !showAdvanced" class="section-toggle">
    Advanced Settings
    <svg :class="{ rotated: showAdvanced }">...</svg>
  </button>
  <div v-if="showAdvanced" class="section-content">
    <!-- content -->
  </div>
</div>

<!-- After -->
<Collapsible v-model:open="showAdvanced">
  <CollapsibleTrigger class="flex w-full items-center justify-between">
    Advanced Settings
    <svg :class="{ 'rotate-180': showAdvanced }">...</svg>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <!-- content -->
  </CollapsibleContent>
</Collapsible>
```

---

### Separator

Visual divider between content.

**Installation:**
```bash
npx shadcn-vue@latest add separator
```

**Import:**
```vue
<script setup>
import { Separator } from '@/components/ui/separator'
</script>
```

**Usage:**

```vue
<template>
  <!-- Horizontal (default) -->
  <Separator class="my-4" />

  <!-- Vertical -->
  <div class="flex h-5 items-center space-x-4">
    <span>Item 1</span>
    <Separator orientation="vertical" />
    <span>Item 2</span>
    <Separator orientation="vertical" />
    <span>Item 3</span>
  </div>

  <!-- With text -->
  <div>
    <h3>Section 1</h3>
    <p>Content here...</p>
  </div>
  <Separator class="my-4" />
  <div>
    <h3>Section 2</h3>
    <p>More content...</p>
  </div>
</template>
```

---

## Overlays & Modals

### Dialog

Modal dialog for focused interactions.

**Installation:**
```bash
npx shadcn-vue@latest add dialog
```

**Import:**
```vue
<script setup>
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Dialog` | Root wrapper |
| `DialogTrigger` | Element that opens dialog |
| `DialogContent` | Modal container |
| `DialogHeader` | Header section |
| `DialogTitle` | Dialog title |
| `DialogDescription` | Subtitle/description |
| `DialogFooter` | Footer with actions |
| `DialogClose` | Close button |

**Usage:**

```vue
<template>
  <!-- Basic dialog -->
  <Dialog>
    <DialogTrigger as-child>
      <Button>Open Dialog</Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogDescription>
          Make changes to your profile here.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <!-- Form fields here -->
      </div>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Controlled dialog -->
  <Dialog v-model:open="isOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Export Data</DialogTitle>
      </DialogHeader>
      <!-- content -->
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue'
const isOpen = ref(false)

// Open programmatically
const openDialog = () => {
  isOpen.value = true
}
</script>
```

**Migration (ExportPanel):**
```vue
<!-- Before -->
<Teleport to="body">
  <div v-if="showExport" class="modal-overlay" @click.self="close">
    <div class="modal-content export-panel">
      <button class="close-btn" @click="close">×</button>
      <h2>Export Data</h2>
      <!-- content -->
    </div>
  </div>
</Teleport>

<!-- After -->
<Dialog v-model:open="showExport">
  <DialogContent class="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Export Data</DialogTitle>
      <DialogDescription>
        Download your filtered data in various formats.
      </DialogDescription>
    </DialogHeader>
    <!-- content -->
    <DialogFooter>
      <Button @click="exportCSV">Export CSV</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Alert Dialog

Confirmation dialog requiring user response.

**Installation:**
```bash
npx shadcn-vue@latest add alert-dialog
```

**Import:**
```vue
<script setup>
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
</script>
```

**Usage:**

```vue
<template>
  <AlertDialog>
    <AlertDialogTrigger as-child>
      <Button variant="destructive">Delete All</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete
          all selected records.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="confirmDelete">
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

---

### Sheet

Slide-out panel from screen edge.

**Installation:**
```bash
npx shadcn-vue@latest add sheet
```

**Import:**
```vue
<script setup>
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
</script>
```

**Props (SheetContent):**
| Prop | Values | Description |
|------|--------|-------------|
| `side` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` | Slide direction |

**Usage:**

```vue
<template>
  <!-- Right side panel (default) -->
  <Sheet>
    <SheetTrigger as-child>
      <Button variant="outline">Open Settings</Button>
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Settings</SheetTitle>
        <SheetDescription>
          Configure your preferences here.
        </SheetDescription>
      </SheetHeader>
      <div class="py-4">
        <!-- Settings content -->
      </div>
      <SheetFooter>
        <SheetClose as-child>
          <Button>Save Changes</Button>
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>

  <!-- Left side panel -->
  <Sheet>
    <SheetTrigger as-child>
      <Button>Menu</Button>
    </SheetTrigger>
    <SheetContent side="left">
      <!-- Navigation menu -->
    </SheetContent>
  </Sheet>
</template>
```

---

### Popover

Floating panel anchored to trigger element.

**Installation:**
```bash
npx shadcn-vue@latest add popover
```

**Import:**
```vue
<script setup>
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
</script>
```

**Usage:**

```vue
<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline">Open Popover</Button>
    </PopoverTrigger>
    <PopoverContent class="w-80">
      <div class="grid gap-4">
        <div class="space-y-2">
          <h4 class="font-medium leading-none">Dimensions</h4>
          <p class="text-sm text-muted-foreground">
            Set the dimensions for the layer.
          </p>
        </div>
        <div class="grid gap-2">
          <div class="grid grid-cols-3 items-center gap-4">
            <Label for="width">Width</Label>
            <Input id="width" class="col-span-2 h-8" />
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
```

**Date Picker Pattern:**
```vue
<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" class="w-[240px] justify-start text-left">
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ date ? formatDate(date) : 'Pick a date' }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0">
      <Calendar v-model="date" />
    </PopoverContent>
  </Popover>
</template>
```

---

### Tooltip

Hover/focus tooltip for additional information.

**Installation:**
```bash
npx shadcn-vue@latest add tooltip
```

**Import:**
```vue
<script setup>
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
</script>
```

**Important:** Wrap your app (or section) with `TooltipProvider`.

**Usage:**

```vue
<template>
  <!-- In App.vue or layout -->
  <TooltipProvider>
    <App />
  </TooltipProvider>

  <!-- Usage -->
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="outline" size="icon">
        <svg class="h-4 w-4">...</svg>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Add to library</p>
    </TooltipContent>
  </Tooltip>

  <!-- With delay -->
  <TooltipProvider :delay-duration="200">
    <Tooltip>
      <TooltipTrigger>Hover me</TooltipTrigger>
      <TooltipContent>
        <p>Appears after 200ms</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
```

---

## Menus & Commands

### Command (Combobox)

Searchable command palette / combobox.

**Installation:**
```bash
npx shadcn-vue@latest add command
```

**Import:**
```vue
<script setup>
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Command` | Root container |
| `CommandInput` | Search input |
| `CommandList` | Scrollable results container |
| `CommandEmpty` | "No results" message |
| `CommandGroup` | Group with label |
| `CommandItem` | Selectable item |
| `CommandSeparator` | Visual divider |
| `CommandShortcut` | Keyboard shortcut hint |
| `CommandDialog` | Command in a modal |

**Usage (Inline Combobox):**

```vue
<template>
  <Command class="rounded-lg border shadow-md">
    <CommandInput placeholder="Search species..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Suggestions">
        <CommandItem
          v-for="item in suggestions"
          :key="item.id"
          :value="item.name"
          @select="selectItem(item)"
        >
          {{ item.name }}
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
</template>
```

**Usage (Combobox with Popover - replacing vue-multiselect):**

```vue
<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-[200px] justify-between"
      >
        {{ selectedValue || "Select species..." }}
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[200px] p-0">
      <Command>
        <CommandInput placeholder="Search species..." />
        <CommandList>
          <CommandEmpty>No species found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="species in speciesList"
              :key="species.value"
              :value="species.value"
              @select="(e) => {
                selectedValue = e.detail.value
                open = false
              }"
            >
              <Check
                :class="cn(
                  'mr-2 h-4 w-4',
                  selectedValue === species.value ? 'opacity-100' : 'opacity-0'
                )"
              />
              {{ species.label }}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script setup>
import { ref } from 'vue'
const open = ref(false)
const selectedValue = ref('')
</script>
```

**Usage (Command Dialog - Cmd+K):**

```vue
<template>
  <CommandDialog v-model:open="open">
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Actions">
        <CommandItem @select="exportData">
          <Download class="mr-2 h-4 w-4" />
          Export Data
          <CommandShortcut>⌘E</CommandShortcut>
        </CommandItem>
        <CommandItem @select="openGallery">
          <Image class="mr-2 h-4 w-4" />
          Open Gallery
          <CommandShortcut>⌘G</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const open = ref(false)

const handleKeydown = (e) => {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>
```

**Migration (FilterSelect/vue-multiselect):**
```vue
<!-- Before (vue-multiselect) -->
<Multiselect
  v-model="selected"
  :options="options"
  :multiple="true"
  :searchable="true"
  placeholder="Select species..."
/>

<!-- After (Command + Popover) -->
<Popover v-model:open="open">
  <PopoverTrigger as-child>
    <Button variant="outline" class="w-full justify-between">
      {{ selected.length ? `${selected.length} selected` : 'Select species...' }}
    </Button>
  </PopoverTrigger>
  <PopoverContent class="w-full p-0">
    <Command>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            v-for="option in options"
            :key="option"
            :value="option"
            @select="toggleSelection(option)"
          >
            <Checkbox :checked="selected.includes(option)" class="mr-2" />
            {{ option }}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

---

### Context Menu

Right-click menu.

**Installation:**
```bash
npx shadcn-vue@latest add context-menu
```

**Import:**
```vue
<script setup>
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
</script>
```

**Usage:**

```vue
<template>
  <ContextMenu>
    <ContextMenuTrigger class="flex h-[150px] w-[300px] items-center justify-center rounded-md border border-dashed">
      Right click here
    </ContextMenuTrigger>
    <ContextMenuContent class="w-64">
      <ContextMenuItem @select="handleCopy">
        Copy
        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="handlePaste">
        Paste
        <ContextMenuShortcut>⌘V</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>More Options</ContextMenuSubTrigger>
        <ContextMenuSubContent class="w-48">
          <ContextMenuItem>Option 1</ContextMenuItem>
          <ContextMenuItem>Option 2</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuCheckboxItem v-model:checked="showGrid">
        Show Grid
      </ContextMenuCheckboxItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
```

---

### Dropdown Menu

Click-triggered dropdown menu.

**Installation:**
```bash
npx shadcn-vue@latest add dropdown-menu
```

**Import:**
```vue
<script setup>
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
</script>
```

**Usage:**

```vue
<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline">Options</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem @select="exportCSV">
          <Download class="mr-2 h-4 w-4" />
          Export CSV
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem @select="exportGeoJSON">
          <FileJson class="mr-2 h-4 w-4" />
          Export GeoJSON
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem v-model:checked="showLegend">
        Show Legend
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Settings class="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem>Preferences</DropdownMenuItem>
          <DropdownMenuItem>About</DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
```

**Migration (column settings dropdown):**
```vue
<!-- Before -->
<div class="dropdown">
  <button @click="showDropdown = !showDropdown">Columns</button>
  <div v-if="showDropdown" class="dropdown-content">
    <label v-for="col in columns" :key="col.key">
      <input type="checkbox" v-model="visibleColumns[col.key]" />
      {{ col.label }}
    </label>
  </div>
</div>

<!-- After -->
<DropdownMenu>
  <DropdownMenuTrigger as-child>
    <Button variant="outline" size="sm">Columns</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem
      v-for="col in columns"
      :key="col.key"
      v-model:checked="visibleColumns[col.key]"
    >
      {{ col.label }}
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Feedback

### Sonner (Toast)

Toast notifications (replaces deprecated Toast component).

**Installation:**
```bash
npx shadcn-vue@latest add sonner
```

**Setup:**

1. Add to your root layout (App.vue):

```vue
<script setup>
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <div>
    <RouterView />
    <Toaster />
  </div>
</template>
```

2. Import the toast function where needed:

```vue
<script setup>
import { toast } from 'vue-sonner'
</script>
```

**Toast Types:**

```js
// Default
toast('Event has been created')

// With description
toast('Event created', {
  description: 'Sunday, December 03, 2023 at 9:00 AM',
})

// Success
toast.success('Successfully saved!')

// Error
toast.error('Something went wrong')

// Warning
toast.warning('Please check your input')

// Info
toast.info('New update available')

// With action button
toast('File deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreFile(),
  },
})

// Promise (async operations)
toast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Data saved!',
  error: 'Could not save.',
})

// Custom duration (ms)
toast('Quick message', {
  duration: 2000,
})

// Dismiss programmatically
const toastId = toast('Loading...')
// Later:
toast.dismiss(toastId)
```

**Migration:**
```vue
<!-- Before -->
<div v-if="showToast" class="toast">
  {{ toastMessage }}
</div>

<script setup>
const showToast = ref(false)
const toastMessage = ref('')

const showMessage = (msg) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 2000)
}
</script>

<!-- After -->
<script setup>
import { toast } from 'vue-sonner'

const showMessage = (msg) => {
  toast(msg)
}

// Or for success/error
const handleExport = async () => {
  toast.promise(exportData(), {
    loading: 'Exporting...',
    success: 'Export complete!',
    error: 'Export failed',
  })
}
</script>
```

---

## Navigation

### Pagination

Page navigation component.

**Installation:**
```bash
npx shadcn-vue@latest add pagination
```

**Import:**
```vue
<script setup>
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
</script>
```

**Subcomponents:**
| Component | Purpose |
|-----------|---------|
| `Pagination` | Root wrapper |
| `PaginationContent` | Container for items |
| `PaginationItem` | Wrapper for each element |
| `PaginationLink` | Page number link |
| `PaginationPrevious` | Previous page button |
| `PaginationNext` | Next page button |
| `PaginationEllipsis` | "..." indicator |

**Usage:**

```vue
<template>
  <Pagination
    :total="totalRecords"
    :items-per-page="pageSize"
    :default-page="1"
    v-slot="{ page }"
  >
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious />
      </PaginationItem>

      <PaginationItem v-for="(item, index) in visiblePages" :key="index">
        <PaginationEllipsis v-if="item === '...'" :index="index" />
        <PaginationLink
          v-else
          :is-active="item === page"
          @click="goToPage(item)"
        >
          {{ item }}
        </PaginationLink>
      </PaginationItem>

      <PaginationItem>
        <PaginationNext />
      </PaginationItem>
    </PaginationContent>
  </Pagination>
</template>
```

**Simplified Usage with v-model:**

```vue
<template>
  <Pagination
    v-model:page="currentPage"
    :total="totalRecords"
    :items-per-page="pageSize"
    :sibling-count="1"
    show-edges
  >
    <PaginationContent>
      <PaginationItem>
        <PaginationPrevious />
      </PaginationItem>
      <PaginationItem>
        <PaginationNext />
      </PaginationItem>
    </PaginationContent>
  </Pagination>

  <p>Page {{ currentPage }} of {{ totalPages }}</p>
</template>

<script setup>
import { ref, computed } from 'vue'

const currentPage = ref(1)
const pageSize = ref(50)
const totalRecords = ref(1000)

const totalPages = computed(() =>
  Math.ceil(totalRecords.value / pageSize.value)
)
</script>
```

---

## Interactive

### Toggle

Single toggle button.

**Installation:**
```bash
npx shadcn-vue@latest add toggle
```

**Import:**
```vue
<script setup>
import { Toggle } from '@/components/ui/toggle'
</script>
```

**Variants & Sizes:**
| Variant | Description |
|---------|-------------|
| `default` | Standard toggle |
| `outline` | Border style |

| Size | Description |
|------|-------------|
| `sm` | Small |
| `default` | Standard |
| `lg` | Large |

**Usage:**

```vue
<template>
  <!-- Basic toggle -->
  <Toggle aria-label="Toggle bold">
    <Bold class="h-4 w-4" />
  </Toggle>

  <!-- With v-model -->
  <Toggle v-model:pressed="isBold">
    <Bold class="h-4 w-4" />
  </Toggle>

  <!-- Outline variant -->
  <Toggle variant="outline">
    <Italic class="h-4 w-4" />
  </Toggle>

  <!-- With text -->
  <Toggle>
    <Bold class="mr-2 h-4 w-4" />
    Bold
  </Toggle>

  <!-- Disabled -->
  <Toggle disabled>
    <Underline class="h-4 w-4" />
  </Toggle>
</template>
```

---

### Toggle Group

Group of toggle buttons (single or multiple selection).

**Installation:**
```bash
npx shadcn-vue@latest add toggle-group
```

**Import:**
```vue
<script setup>
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
</script>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `type` | `"single"` \| `"multiple"` | Selection mode |
| `variant` | `"default"` \| `"outline"` | Style variant |
| `size` | `"sm"` \| `"default"` \| `"lg"` | Size |

**Usage:**

```vue
<template>
  <!-- Single selection (like radio) -->
  <ToggleGroup type="single" v-model="alignment">
    <ToggleGroupItem value="left" aria-label="Align left">
      <AlignLeft class="h-4 w-4" />
    </ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center">
      <AlignCenter class="h-4 w-4" />
    </ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right">
      <AlignRight class="h-4 w-4" />
    </ToggleGroupItem>
  </ToggleGroup>

  <!-- Multiple selection -->
  <ToggleGroup type="multiple" v-model="formatting">
    <ToggleGroupItem value="bold">
      <Bold class="h-4 w-4" />
    </ToggleGroupItem>
    <ToggleGroupItem value="italic">
      <Italic class="h-4 w-4" />
    </ToggleGroupItem>
    <ToggleGroupItem value="underline">
      <Underline class="h-4 w-4" />
    </ToggleGroupItem>
  </ToggleGroup>

  <!-- Outline variant -->
  <ToggleGroup type="single" variant="outline">
    <ToggleGroupItem value="a">A</ToggleGroupItem>
    <ToggleGroupItem value="b">B</ToggleGroupItem>
    <ToggleGroupItem value="c">C</ToggleGroupItem>
  </ToggleGroup>
</template>
```

---

## Utility Functions

### cn() - Class Name Merge

shadcn-vue includes a utility for merging Tailwind classes:

```js
// In src/lib/utils.js (auto-generated)
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

**Usage:**

```vue
<script setup>
import { cn } from '@/lib/utils'
</script>

<template>
  <div :class="cn(
    'base-class',
    isActive && 'active-class',
    variant === 'large' && 'text-lg'
  )">
    Content
  </div>
</template>
```

---

## Component Summary Table

| Component | CLI Command | Primary Use Case |
|-----------|------------|------------------|
| Button | `add button` | All clickable actions |
| Input | `add input` | Text entry |
| Textarea | `add textarea` | Multi-line text |
| Select | `add select` | Single dropdown selection |
| Checkbox | `add checkbox` | Boolean toggles |
| Switch | `add switch` | On/off toggles |
| Slider | `add slider` | Numeric ranges |
| Label | `add label` | Form field labels |
| Badge | `add badge` | Status indicators |
| Table | `add table` | Data tables |
| Card | `add card` | Content containers |
| Avatar | `add avatar` | User images |
| Skeleton | `add skeleton` | Loading states |
| Progress | `add progress` | Progress bars |
| Tabs | `add tabs` | Tab navigation |
| Accordion | `add accordion` | Collapsible sections |
| Collapsible | `add collapsible` | Simple expand/collapse |
| Separator | `add separator` | Visual dividers |
| Dialog | `add dialog` | Modal dialogs |
| Alert Dialog | `add alert-dialog` | Confirmations |
| Sheet | `add sheet` | Slide-out panels |
| Popover | `add popover` | Floating content |
| Tooltip | `add tooltip` | Hover hints |
| Command | `add command` | Search/combobox |
| Context Menu | `add context-menu` | Right-click menus |
| Dropdown Menu | `add dropdown-menu` | Click menus |
| Sonner | `add sonner` | Toast notifications |
| Pagination | `add pagination` | Page navigation |
| Toggle | `add toggle` | Toggle buttons |
| Toggle Group | `add toggle-group` | Button groups |

---

## References

- [shadcn-vue Documentation](https://www.shadcn-vue.com/docs)
- [shadcn-vue GitHub](https://github.com/unovue/shadcn-vue)
- [Reka UI (Primitives)](https://reka-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/icons/)
