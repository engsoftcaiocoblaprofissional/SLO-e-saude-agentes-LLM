<template>
  <div class="runs">
    <div class="header">
      <h1>Runs</h1>
      <button class="btn btn-primary" @click="showCreateModal = true">Create Run</button>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Route</th>
            <th>Status</th>
            <th>Risk Score</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td>{{ run.id.substring(0, 8) }}...</td>
            <td>{{ run.client_id }}</td>
            <td>{{ run.route_path }}</td>
            <td>
              <span :class="getStatusBadge(run.status)">{{ run.status }}</span>
            </td>
            <td>{{ run.risk_score || 'N/A' }}</td>
            <td>{{ formatDate(run.created_at) }}</td>
            <td>
              <button class="btn btn-secondary" @click="viewTrace(run.id)">Trace</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showCreateModal" class="modal" @click.self="showCreateModal = false">
      <div class="modal-content">
        <h2>Create Run</h2>
        <form @submit.prevent="createRun">
          <div class="form-group">
            <label>Client ID</label>
            <input v-model="newRun.client_id" required />
          </div>
          <div class="form-group">
            <label>Route Path</label>
            <input v-model="newRun.route_path" required />
          </div>
          <div class="form-group">
            <label>Input Data (JSON)</label>
            <textarea v-model="newRun.input_data" rows="5" required></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create</button>
            <button type="button" class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Runs',
  data() {
    return {
      runs: [],
      showCreateModal: false,
      newRun: {
        client_id: '',
        route_path: '',
        input_data: '{}'
      }
    }
  },
  mounted() {
    this.loadRuns()
  },
  methods: {
    async loadRuns() {
      try {
        const response = await axios.get('/api/v1/runs')
        this.runs = response.data.runs || []
      } catch (error) {
        console.error('Error loading runs:', error)
      }
    },
    async createRun() {
      try {
        const inputData = JSON.parse(this.newRun.input_data)
        await axios.post('/api/v1/runs', {
          client_id: this.newRun.client_id,
          route_path: this.newRun.route_path,
          input_data: inputData
        })
        this.showCreateModal = false
        this.newRun = { client_id: '', route_path: '', input_data: '{}' }
        this.loadRuns()
      } catch (error) {
        alert('Error creating run: ' + error.message)
      }
    },
    viewTrace(runId) {
      this.$router.push(`/traces/${runId}`)
    },
    getStatusBadge(status) {
      const badges = {
        'completed': 'badge badge-success',
        'error': 'badge badge-danger',
        'blocked': 'badge badge-warning',
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

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}
</style>
