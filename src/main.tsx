import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, QueryProvider } from '@/app/providers'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider defaultTheme="dark" storageKey="ithomiini-theme">
        <App />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
)
