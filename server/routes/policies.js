import express from 'express';
import { PolicyEngine } from '../core/PolicyEngine.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger();
const policyEngine = new PolicyEngine();

/**
 * POST /v1/policies
 * Create or update a policy
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      client_id,
      route_path,
      rules,
      tool_whitelist,
      tool_blacklist,
      max_risk_score,
      require_approval,
      data_redaction_enabled,
      prompt_injection_shield,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Missing required field: name',
      });
    }

    const policy = await policyEngine.createOrUpdatePolicy({
      name,
      client_id,
      route_path,
      rules,
      tool_whitelist,
      tool_blacklist,
      max_risk_score,
      require_approval,
      data_redaction_enabled,
      prompt_injection_shield,
    });

    res.status(201).json({
      policy,
      message: 'Policy created/updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/policies
 * List policies
 */
router.get('/', async (req, res, next) => {
  try {
    const { client_id, route_path, active } = req.query;
    const { db } = await import('../db/connection.js');

    let query = 'SELECT * FROM policies WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (client_id) {
      query += ` AND client_id = $${paramCount++}`;
      params.push(client_id);
    }

    if (route_path) {
      query += ` AND route_path = $${paramCount++}`;
      params.push(route_path);
    }

    if (active !== undefined) {
      query += ` AND active = $${paramCount++}`;
      params.push(active === 'true');
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    res.json({
      policies: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/policies/:id
 * Get policy by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { db } = await import('../db/connection.js');

    const result = await db.query(
      'SELECT * FROM policies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Policy not found',
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
