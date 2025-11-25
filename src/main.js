import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Log build info for debugging
console.log('Ithomiini Maps')
console.log('Build:', typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev')
console.log('Commit:', typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'local')
