import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, QueryProvider, NuqsProvider } from '@/app/providers'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NuqsProvider>
      <QueryProvider>
        <ThemeProvider defaultTheme="dark" storageKey="ithomiini-theme">
          <App />
        </ThemeProvider>
      </QueryProvider>
    </NuqsProvider>
  </StrictMode>,
)
