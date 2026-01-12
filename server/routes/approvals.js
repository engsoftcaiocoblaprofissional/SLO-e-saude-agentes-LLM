import express from 'express';
import { db } from '../db/connection.js';
import { AuditTrail } from '../core/AuditTrail.js';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const logger = createLogger();
const auditTrail = new AuditTrail();

/**
 * POST /v1/approvals/:run_id
 * Approve or reject a run
 */
router.post('/:run_id', async (req, res, next) => {
  try {
    const { run_id } = req.params;
    const { action, approved_by, rejection_reason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action. Must be "approve" or "reject"',
      });
    }

    // Get approval record
    const approvalResult = await db.query(
      `SELECT * FROM approvals WHERE run_id = $1 AND status = 'pending'`,
      [run_id]
    );

    if (approvalResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No pending approval found for this run',
      });
    }

    const approval = approvalResult.rows[0];

    if (action === 'approve') {
      await db.query(
        `UPDATE approvals SET 
          status = 'approved',
          approved_at = NOW(),
          approved_by = $1
        WHERE id = $2`,
        [approved_by || 'system', approval.id]
      );

      await db.query(
        `UPDATE runs SET 
          approved = true,
          approved_by = $1,
          approved_at = NOW(),
          status = 'processing'
        WHERE id = $2`,
        [approved_by || 'system', run_id]
      );

      // Continue execution
      // Here you would trigger the actual LLM execution
      // For now, we'll mark it as completed
      await db.query(
        `UPDATE runs SET 
          status = 'completed',
          completed_at = NOW()
        WHERE id = $1`,
        [run_id]
      );

      await auditTrail.logEvent(run_id, 'APPROVAL_GRANTED', {
        approved_by: approved_by || 'system',
      });

      res.json({
        run_id,
        status: 'approved',
        message: 'Run approved and execution completed',
      });
    } else {
      if (!rejection_reason) {
        return res.status(400).json({
          error: 'Rejection reason is required',
        });
      }

      await db.query(
        `UPDATE approvals SET 
          status = 'rejected',
          rejected_at = NOW(),
          approved_by = $1,
          rejection_reason = $2
        WHERE id = $3`,
        [approved_by || 'system', rejection_reason, approval.id]
      );

      await db.query(
        `UPDATE runs SET 
          approved = false,
          approved_by = $1,
          status = 'rejected',
          error_message = $2
        WHERE id = $3`,
        [approved_by || 'system', rejection_reason, run_id]
      );

      await auditTrail.logEvent(run_id, 'APPROVAL_REJECTED', {
        approved_by: approved_by || 'system',
        rejection_reason,
      });

      res.json({
        run_id,
        status: 'rejected',
        message: 'Run rejected',
        rejection_reason,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/approvals
 * List pending approvals
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;

    let query = 'SELECT * FROM approvals';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY requested_at DESC';

    const result = await db.query(query, params);

    res.json({
      approvals: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
