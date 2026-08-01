import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'virtual:uno.css'

import App from './App.vue'
import router from './router'
import { tournament } from './app/documentStore'
import { resumeFromAutosave, startAutosaveWatch } from './features/tournament-doc/storage/autosave'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Crash-recovery: restore the last autosaved session BEFORE mounting (so the
// user never sees the default doc flash, and an in-flight first edit can't be
// clobbered by a late restore), then keep persisting ongoing edits. Explicit
// file save remains the authoritative action.
resumeFromAutosave(tournament).then(() => {
  startAutosaveWatch(tournament)
  app.mount('#app')
})
