import { useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { Panel, Stack, Section } from '@/shared/layout'
import {
  useRecords,
  useDataStore,
  useFilteredCount,
  useTotalCount,
  useUniqueSources,
} from '@/features/data'

function App() {
  // Load records from JSON
  const { data: records, isLoading, error } = useRecords()
  const setRecords = useDataStore((s) => s.setRecords)

  // Populate store when data loads
  useEffect(() => {
    if (records) {
      setRecords(records)
    }
  }, [records, setRecords])

  // Get counts from store
  const totalCount = useTotalCount()
  const filteredCount = useFilteredCount()
  const sources = useUniqueSources()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Ithomiini Maps</h1>
          <ModeToggle />
        </header>

        <main>
          <Stack gap="lg">
            {/* Data Loading Status */}
            <Panel>
              <Section title="Data Status">
                {isLoading && (
                  <p className="text-muted-foreground">Loading records...</p>
                )}
                {error && (
                  <p className="text-destructive">
                    Error loading data: {error.message}
                  </p>
                )}
                {!isLoading && !error && (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {filteredCount.toLocaleString()} / {totalCount.toLocaleString()} records
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sources: {sources.join(', ') || 'None loaded'}
                    </p>
                  </div>
                )}
              </Section>
            </Panel>

            {/* Project Info */}
            <Panel>
              <Section title="React + Vite + shadcn/ui">
                <p className="text-muted-foreground mb-4">
                  Project scaffolding complete! Data layer implemented with Zustand + TanStack Query.
                </p>
                <div className="flex gap-4 flex-wrap">
                  <Button>Primary Button</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </Section>
            </Panel>

            {/* Build Info */}
            <Panel>
              <Section title="Build Info">
                <p className="text-sm text-muted-foreground">
                  Build time: {__BUILD_TIME__}
                  <br />
                  Commit: {__COMMIT_HASH__}
                </p>
              </Section>
            </Panel>
          </Stack>
        </main>
      </div>
    </div>
  )
}

export default App
