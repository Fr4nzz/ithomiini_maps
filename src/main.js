import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// Tailwind CSS + shadcn-vue theme (must come first)
import './index.css'

// Legacy styles (MapLibre overrides, animations - will be migrated gradually)
import './style.css'

// Import vue-multiselect CSS (will be removed after migration to shadcn Command)
import 'vue-multiselect/dist/vue-multiselect.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Log build info for debugging
console.log('Ithomiini Maps')
console.log('Build:', typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev')
console.log('Commit:', typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'local')
