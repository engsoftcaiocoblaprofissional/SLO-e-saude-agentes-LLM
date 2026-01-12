<template>
  <div class="policies">
    <div class="header">
      <h1>Policies</h1>
      <button class="btn btn-primary" @click="showCreateModal = true">Create Policy</button>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Client ID</th>
            <th>Route Path</th>
            <th>Max Risk Score</th>
            <th>Version</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="policy in policies" :key="policy.id">
            <td>{{ policy.name }}</td>
            <td>{{ policy.client_id || 'All' }}</td>
            <td>{{ policy.route_path || 'All' }}</td>
            <td>{{ policy.max_risk_score }}</td>
            <td>{{ policy.version }}</td>
            <td>
              <span :class="policy.active ? 'badge badge-success' : 'badge badge-danger'">
                {{ policy.active ? 'Yes' : 'No' }}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary" @click="viewPolicy(policy.id)">View</button>
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
  name: 'Policies',
  data() {
    return {
      policies: [],
      showCreateModal: false
    }
  },
  mounted() {
    this.loadPolicies()
  },
  methods: {
    async loadPolicies() {
      try {
        const response = await axios.get('/api/v1/policies')
        this.policies = response.data.policies || []
      } catch (error) {
        console.error('Error loading policies:', error)
      }
    },
    viewPolicy(policyId) {
      // Implementar visualização de política
      console.log('View policy:', policyId)
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
