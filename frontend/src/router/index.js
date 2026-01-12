import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Runs from '../views/Runs.vue'
import Policies from '../views/Policies.vue'
import Evals from '../views/Evals.vue'
import Metrics from '../views/Metrics.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/runs',
    name: 'Runs',
    component: Runs
  },
  {
    path: '/policies',
    name: 'Policies',
    component: Policies
  },
  {
    path: '/evals',
    name: 'Evals',
    component: Evals
  },
  {
    path: '/metrics',
    name: 'Metrics',
    component: Metrics
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
