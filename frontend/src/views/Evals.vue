<template>
  <div class="evals">
    <div class="header">
      <h1>Evaluations</h1>
      <button class="btn btn-primary" @click="showCreateModal = true">Run Evaluation</button>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Passed</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="eval in evals" :key="eval.id">
            <td>{{ eval.name }}</td>
            <td>
              <span :class="getStatusBadge(eval.status)">{{ eval.status }}</span>
            </td>
            <td>
              <span :class="eval.passed ? 'badge badge-success' : 'badge badge-danger'">
                {{ eval.passed ? 'Yes' : 'No' }}
              </span>
            </td>
            <td>{{ formatDate(eval.created_at) }}</td>
            <td>
              <button class="btn btn-secondary" @click="viewResults(eval.id)">View Results</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Evals',
  data() {
    return {
      evals: [],
      showCreateModal: false
    }
  },
  mounted() {
    this.loadEvals()
  },
  methods: {
    async loadEvals() {
      try {
        const response = await axios.get('/api/v1/evals')
        this.evals = response.data.eval_runs || []
      } catch (error) {
        console.error('Error loading evals:', error)
      }
    },
    viewResults(evalId) {
      // Implementar visualização de resultados
      console.log('View results:', evalId)
    },
    getStatusBadge(status) {
      const badges = {
        'completed': 'badge badge-success',
        'error': 'badge badge-danger',
        'pending': 'badge badge-info'
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
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
</style>
