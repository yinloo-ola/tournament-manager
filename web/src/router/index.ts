import { tournament } from '@/store/state'
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      // Home is the launcher — the empty state of the single app-bar shell
      // (decision 01). It is the landing route and the catch-all, so any
      // unmatched hash drops the user back at the launcher rather than a
      // blank page.
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/tournament',
      name: 'tournament',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) that is
      // lazy-loaded when the route is visited.
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
    },
    // Any other path → back to the launcher.
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router
