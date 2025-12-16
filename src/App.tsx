import { useEffect } from 'react'
import { ModeToggle } from '@/components/mode-toggle'
import { useRecords, useDataStore } from '@/features/data'
import { MapView } from '@/features/map'

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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h1 className="text-xl font-bold">Ithomiini Maps</h1>
        <ModeToggle />
      </header>

      {/* Main content */}
      <main className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <p className="text-muted-foreground">Loading records...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <p className="text-destructive">Error: {error.message}</p>
          </div>
        )}
        <MapView />
      </main>
    </div>
  )
}

export default App
