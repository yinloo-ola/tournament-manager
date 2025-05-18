import { tournament } from '@/store/state'
import { createRouter, createWebHashHistory } from 'vue-router'
import { apiGetTournamentById } from '@/client/client'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/tournament',
      name: 'tournament',
      component: () => import('../views/TournamentView.vue')
    },
    {
      path: '/tournament/:id',
      name: 'tournamentDetail',
      component: () => import('../views/TournamentView.vue'),
      props: true,
      beforeEnter: async (to, _, next) => {
        try {
          const id = to.params.id as string
          if (id) {
            const tournamentData = await apiGetTournamentById(id)
            tournament.value = tournamentData
          }
          next()
        } catch (err) {
          console.error('Failed to load tournament:', err)
          next('/tournament')
        }
      }
    },
    {
      path: '/tournament/matches/:shortName',
      name: 'matches',
      component: () => import('../views/MatchesView.vue'),
      props: true,
      beforeEnter: (to, _, next) => {
        const shortName = to.params.shortName
        const category = tournament.value.categories.find((c) => c.shortName === shortName)
        if (!category) {
          next('/tournament')
        } else {
          next()
        }
      }
    }
  ]
})

export default router
