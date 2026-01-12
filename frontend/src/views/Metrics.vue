<template>
  <div class="metrics">
    <h1>SLO Metrics</h1>

    <div class="card">
      <h2>Task Success Rate</h2>
      <p class="metric-value">{{ metrics.task_success_rate?.rate ? (metrics.task_success_rate.rate * 100).toFixed(2) : 0 }}%</p>
      <p class="metric-detail">
        {{ metrics.task_success_rate?.successful || 0 }} successful out of 
        {{ metrics.task_success_rate?.total || 0 }} total tasks
      </p>
    </div>

    <div class="card">
      <h2>Tool Failure Rate</h2>
      <p class="metric-value">{{ metrics.tool_failure_rate?.overall_rate ? (metrics.tool_failure_rate.overall_rate * 100).toFixed(2) : 0 }}%</p>
    </div>

    <div class="card">
      <h2>Human Escalation Rate</h2>
      <p class="metric-value">{{ metrics.escalation_rate?.rate ? (metrics.escalation_rate.rate * 100).toFixed(2) : 0 }}%</p>
    </div>

    <div class="card">
      <h2>Cost Metrics</h2>
      <p class="metric-value">${{ metrics.cost_metrics?.avg_cost_per_task?.toFixed(4) || '0.0000' }}</p>
      <p class="metric-detail">Average cost per task</p>
    </div>

    <div class="card">
      <h2>Latency Metrics</h2>
      <div class="latency-grid">
        <div>
          <strong>P95:</strong> {{ metrics.latency_metrics?.p95?.toFixed(2) || '0.00' }}s
        </div>
        <div>
          <strong>P99:</strong> {{ metrics.latency_metrics?.p99?.toFixed(2) || '0.00' }}s
        </div>
        <div>
          <strong>Avg:</strong> {{ metrics.latency_metrics?.avg?.toFixed(2) || '0.00' }}s
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Policy Incidents</h2>
      <p class="metric-value">{{ metrics.policy_incidents?.total_blocked || 0 }}</p>
      <p class="metric-detail">
        PII Incidents: {{ metrics.policy_incidents?.pii_incidents || 0 }}<br>
        Policy Violations: {{ metrics.policy_incidents?.policy_violations || 0 }}
      </p>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Metrics',
  data() {
    return {
      metrics: {}
    }
  },
  mounted() {
    this.loadMetrics()
  },
  methods: {
    async loadMetrics() {
      try {
        const response = await axios.get('/api/v1/metrics/slo?hours=24')
        this.metrics = response.data || {}
      } catch (error) {
        console.error('Error loading metrics:', error)
      }
    }
  }
}
</script>

<style scoped>
.metric-value {
  font-size: 2.5rem;
  font-weight: 600;
  color: #4CAF50;
  margin: 1rem 0;
}

.metric-detail {
  color: #666;
  font-size: 0.9rem;
}

.latency-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}
</style>
