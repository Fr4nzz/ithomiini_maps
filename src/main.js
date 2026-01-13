import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

// Import vue-multiselect CSS
import 'vue-multiselect/dist/vue-multiselect.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Initialize theme store (applies stored theme on load)
import { useThemeStore } from './stores/theme'
const themeStore = useThemeStore(pinia)

// Log build info for debugging
console.log('Ithomiini Maps')
console.log('Build:', typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev')
console.log('Commit:', typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'local')
console.log('Theme:', themeStore.currentTheme)
