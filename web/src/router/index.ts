import { tournament } from '@/store/state'
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/tournament',
      name: 'tournament',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/TournamentView.vue')
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
