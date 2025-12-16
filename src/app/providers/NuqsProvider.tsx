import { NuqsAdapter } from 'nuqs/adapters/react'

interface NuqsProviderProps {
  children: React.ReactNode
}

export function NuqsProvider({ children }: NuqsProviderProps) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
