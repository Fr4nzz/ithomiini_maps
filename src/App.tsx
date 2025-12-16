import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Ithomiini Maps</h1>
          <ModeToggle />
        </header>

        <main className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">React + Vite + shadcn/ui</h2>
            <p className="text-muted-foreground mb-4">
              Project scaffolding complete! Ready to build the Ithomiini Maps application.
            </p>
            <div className="flex gap-4">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Installed Dependencies</h2>
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
              <li>- Zustand (state)</li>
              <li>- TanStack Query</li>
              <li>- TanStack Table</li>
              <li>- TanStack Virtual</li>
              <li>- MapLibre GL</li>
              <li>- nuqs (URL state)</li>
              <li>- uFuzzy (search)</li>
              <li>- Zod (validation)</li>
              <li>- html-to-image</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
