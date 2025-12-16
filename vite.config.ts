import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'child_process'

// https://vite.dev/config/
export default defineConfig({
  base: '/ithomiini_maps/',

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(
      process.env.GITHUB_SHA ||
        (() => {
          try {
            return execSync('git rev-parse --short HEAD').toString().trim()
          } catch {
            return 'dev'
          }
        })()
    ),
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          map: ['maplibre-gl'],
          table: ['@tanstack/react-table', '@tanstack/react-virtual'],
        },
      },
    },
  },
})
