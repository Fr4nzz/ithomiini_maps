import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // GitHub Pages deployment - repository name as base path
  // Change this if your repo name is different
  base: '/ithomiini_maps/',
  
  // Build optimization
  build: {
    // Generate source maps for debugging
    sourcemap: false,
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Rollup options
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'vue-vendor': ['vue', 'pinia'],
        }
      }
    }
  },
  
  // Define global constants (for citation versioning)
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(process.env.GITHUB_SHA || 'dev'),
  },
  
  // Dev server options
  server: {
    port: 5173,
    open: true,
  }
})
