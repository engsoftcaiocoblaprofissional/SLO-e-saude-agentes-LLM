<template>
  <div class="dashboard">
    <h1>Dashboard</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Runs</h3>
        <p class="stat-value">{{ summary.total_runs || 0 }}</p>
      </div>
      <div class="stat-card">
        <h3>Success Rate</h3>
        <p class="stat-value">{{ successRate }}%</p>
      </div>
      <div class="stat-card">
        <h3>Blocked Runs</h3>
        <p class="stat-value">{{ summary.blocked_runs || 0 }}</p>
      </div>
      <div class="stat-card">
        <h3>Avg Risk Score</h3>
        <p class="stat-value">{{ avgRiskScore }}</p>
      </div>
    </div>

    <div class="card">
      <h2>Recent Runs</h2>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Route</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in recentRuns" :key="run.id">
            <td>{{ run.id.substring(0, 8) }}...</td>
            <td>{{ run.client_id }}</td>
            <td>{{ run.route_path }}</td>
            <td>
              <span :class="getStatusBadge(run.status)">{{ run.status }}</span>
            </td>
            <td>{{ run.risk_score || 'N/A' }}</td>
            <td>{{ formatDate(run.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Dashboard',
  data() {
    return {
      summary: {},
      recentRuns: []
    }
  },
  computed: {
    successRate() {
      if (!this.summary.total_runs) return 0
      return Math.round((this.summary.successful_runs / this.summary.total_runs) * 100)
    },
    avgRiskScore() {
      return this.summary.avg_risk_score 
        ? this.summary.avg_risk_score.toFixed(2) 
        : 'N/A'
    }
  },
  mounted() {
    this.loadSummary()
    this.loadRecentRuns()
  },
  methods: {
    async loadSummary() {
      try {
        const response = await axios.get('/api/v1/metrics/summary?hours=24')
        this.summary = response.data.summary || {}
      } catch (error) {
        console.error('Error loading summary:', error)
      }
    },
    async loadRecentRuns() {
      try {
        const response = await axios.get('/api/v1/runs?limit=10')
        this.recentRuns = response.data.runs || []
      } catch (error) {
        console.error('Error loading recent runs:', error)
      }
    },
    getStatusBadge(status) {
      const badges = {
        'completed': 'badge badge-success',
        'error': 'badge badge-danger',
        'blocked': 'badge badge-warning',
        'pending': 'badge badge-info',
        'pending_approval': 'badge badge-warning'
      }
      return badges[status] || 'badge'
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleString('pt-BR')
    }
  }
}
</script>

<style scoped>
.dashboard h1 {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-card h3 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: #333;
}
</style>
