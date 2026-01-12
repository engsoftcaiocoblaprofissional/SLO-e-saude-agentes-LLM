import express from 'express';
import { AuditTrail } from '../core/AuditTrail.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger();
const auditTrail = new AuditTrail();

/**
 * GET /v1/traces/:run_id
 * Get complete trace for a run
 */
router.get('/:run_id', async (req, res, next) => {
  try {
    const { run_id } = req.params;

    const trace = await auditTrail.getTrace(run_id);

    if (!trace) {
      return res.status(404).json({
        error: 'Run not found',
      });
    }

    res.json(trace);
  } catch (error) {
    next(error);
  }
});

export default router;
