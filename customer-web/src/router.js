import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import AuthCallback from './views/AuthCallback.vue'
import Cases from './views/Cases.vue'
import Profile from './views/Profile.vue'
import SetupProfile from './views/SetupProfile.vue'
import { setUnauthorizedHandler, clearAuth } from './api'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/cases' },
    { path: '/login', name: 'login', component: Login },
    { path: '/auth/wechat/callback', name: 'wechat-callback', component: AuthCallback },
    { path: '/cases', name: 'cases', component: Cases, meta: { auth: true, nav: true } },
    { path: '/profile', name: 'profile', component: Profile, meta: { auth: true, nav: true } },
    { path: '/setup-profile', name: 'setup-profile', component: SetupProfile, meta: { auth: true } },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('appeal_token')
  if (to.meta.auth && !token) return { path: '/login', query: { redirect: to.fullPath } }
  return true
})

setUnauthorizedHandler(() => {
  clearAuth()
  router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
})

export default router
