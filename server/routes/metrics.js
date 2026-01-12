import express from 'express';
import { db } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger();

router.get('/slo', async (req, res, next) => {
  try {
    const { client_id, metric_name, window_start, window_end } = req.query;

    let query = 'SELECT * FROM slo_metrics WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (client_id) {
      query += ` AND client_id = $${paramCount++}`;
      params.push(client_id);
    }

    if (metric_name) {
      query += ` AND metric_name = $${paramCount++}`;
      params.push(metric_name);
    }

    if (window_start) {
      query += ` AND window_start >= $${paramCount++}`;
      params.push(window_start);
    }

    if (window_end) {
      query += ` AND window_end <= $${paramCount++}`;
      params.push(window_end);
    }

    query += ' ORDER BY window_start DESC LIMIT 1000';

    const result = await db.query(query, params);

    res.json({
      metrics: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const { client_id, route_path, hours = 24 } = req.query;

    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours));

    let query = `
      SELECT 
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
        COUNT(*) FILTER (WHERE status = 'error') as failed_runs,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked_runs,
        COUNT(*) FILTER (WHERE requires_approval = true) as approval_required,
        AVG(risk_score) as avg_risk_score,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
      FROM runs
      WHERE created_at >= $1
    `;
    const params = [hoursAgo];
    let paramCount = 2;

    if (client_id) {
      query += ` AND client_id = $${paramCount++}`;
      params.push(client_id);
    }

    if (route_path) {
      query += ` AND route_path = $${paramCount++}`;
      params.push(route_path);
    }

    const result = await db.query(query, params);

    const toolQuery = `
      SELECT 
        tool_name,
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE executed = false OR execution_error IS NOT NULL) as failed_executions
      FROM tool_executions
      WHERE timestamp >= $1
      GROUP BY tool_name
    `;
    const toolResult = await db.query(toolQuery, [hoursAgo]);

    const incidentQuery = `
      SELECT COUNT(*) as policy_incidents
      FROM runs
      WHERE created_at >= $1 AND status = 'blocked'
    `;
    const incidentParams = [hoursAgo];
    if (client_id) {
      incidentQuery += ` AND client_id = $2`;
      incidentParams.push(client_id);
    }
    const incidentResult = await db.query(incidentQuery, incidentParams);

    res.json({
      summary: result.rows[0],
      tool_failures: toolResult.rows,
      policy_incidents: incidentResult.rows[0]?.policy_incidents || 0,
      time_window_hours: parseInt(hours),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
