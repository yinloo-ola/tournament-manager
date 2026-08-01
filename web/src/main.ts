import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'virtual:uno.css'

import App from './App.vue'
import router from './router'
import { tournament } from './app/documentStore'
import { startAutosaveWatch, loadAutosave } from './features/tournament-doc/storage/autosave'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Crash-recovery: restore the last autosaved session, then keep persisting
// ongoing edits. Explicit file save remains the authoritative action.
loadAutosave().then((saved) => {
  if (saved) tournament.value = saved
})
startAutosaveWatch(tournament)

app.mount('#app')
