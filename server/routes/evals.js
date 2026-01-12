import express from 'express';
import { db } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';
import axios from 'axios';

const router = express.Router();
const logger = createLogger();

/**
 * POST /v1/evals/run
 * Run evaluation tests
 */
router.post('/run', async (req, res, next) => {
  try {
    const { name, dataset_path, policy_id, metadata } = req.body;

    if (!name || !dataset_path) {
      return res.status(400).json({
        error: 'Missing required fields: name, dataset_path',
      });
    }

    // Create eval run record
    const evalResult = await db.query(
      `INSERT INTO eval_runs (
        name, dataset_path, policy_id, status, metadata
      ) VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *`,
      [
        name,
        dataset_path,
        policy_id || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    const evalRun = evalResult.rows[0];

    // Trigger evaluation in Python service
    try {
      const evalResponse = await axios.post(
        `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/evals/run`,
        {
          eval_run_id: evalRun.id,
          dataset_path,
          policy_id,
        }
      );

      // Update eval run with results
      await db.query(
        `UPDATE eval_runs SET 
          status = 'completed',
          results = $1,
          scores = $2,
          passed = $3,
          completed_at = NOW()
        WHERE id = $4`,
        [
          JSON.stringify(evalResponse.data.results || {}),
          JSON.stringify(evalResponse.data.scores || {}),
          evalResponse.data.passed || false,
          evalRun.id,
        ]
      );

      res.status(202).json({
        eval_run_id: evalRun.id,
        status: 'completed',
        results: evalResponse.data.results,
        scores: evalResponse.data.scores,
        passed: evalResponse.data.passed,
      });
    } catch (error) {
      logger.error('Error running evaluation', { error: error.message });
      
      await db.query(
        `UPDATE eval_runs SET 
          status = 'error',
          results = $1
        WHERE id = $2`,
        [
          JSON.stringify({ error: error.message }),
          evalRun.id,
        ]
      );

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/evals/:id
 * Get evaluation results
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM eval_runs WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Evaluation run not found',
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/evals
 * List evaluation runs
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM eval_runs';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(query, params);

    res.json({
      eval_runs: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
