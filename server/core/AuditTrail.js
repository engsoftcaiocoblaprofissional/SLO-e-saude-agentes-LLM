import { db } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export class AuditTrail {
  /**
   * Log event to audit trail
   */
  async logEvent(runId, eventType, eventData, metadata = {}) {
    try {
      await db.query(
        `INSERT INTO audit_trail (
          run_id, event_type, event_data, policy_version, 
          prompt_version, model_version, user_id, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          runId,
          eventType,
          JSON.stringify(eventData),
          metadata.policyVersion || null,
          metadata.promptVersion || null,
          metadata.modelVersion || null,
          metadata.userId || null,
          metadata.ipAddress || null,
        ]
      );
    } catch (error) {
      logger.error('Error logging audit event', {
        error: error.message,
        runId,
        eventType,
      });
    }
  }

  /**
   * Get full trace for a run
   */
  async getTrace(runId) {
    try {
      // Get run details
      const runResult = await db.query(
        'SELECT * FROM runs WHERE id = $1',
        [runId]
      );

      if (runResult.rows.length === 0) {
        return null;
      }

      const run = runResult.rows[0];

      // Get audit trail
      const auditResult = await db.query(
        `SELECT * FROM audit_trail 
         WHERE run_id = $1 
         ORDER BY timestamp ASC`,
        [runId]
      );

      // Get tool executions
      const toolsResult = await db.query(
        `SELECT * FROM tool_executions 
         WHERE run_id = $1 
         ORDER BY timestamp ASC`,
        [runId]
      );

      // Get redaction logs
      const redactionResult = await db.query(
        `SELECT * FROM redaction_logs 
         WHERE run_id = $1 
         ORDER BY timestamp ASC`,
        [runId]
      );

      // Get prompt injection detections
      const piResult = await db.query(
        `SELECT * FROM prompt_injection_detections 
         WHERE run_id = $1 
         ORDER BY timestamp ASC`,
        [runId]
      );

      // Get approvals
      const approvalResult = await db.query(
        `SELECT * FROM approvals 
         WHERE run_id = $1 
         ORDER BY requested_at ASC`,
        [runId]
      );

      return {
        run: {
          id: run.id,
          client_id: run.client_id,
          route_path: run.route_path,
          status: run.status,
          risk_score: run.risk_score,
          input_data: run.input_data,
          output_data: run.output_data,
          created_at: run.created_at,
          completed_at: run.completed_at,
        },
        audit_events: auditResult.rows.map(row => ({
          event_type: row.event_type,
          event_data: row.event_data,
          timestamp: row.timestamp,
        })),
        tool_executions: toolsResult.rows.map(row => ({
          tool_name: row.tool_name,
          tool_params: row.tool_params,
          allowed: row.allowed,
          blocked_reason: row.blocked_reason,
          executed: row.executed,
          execution_result: row.execution_result,
          execution_error: row.execution_error,
          execution_time_ms: row.execution_time_ms,
          timestamp: row.timestamp,
        })),
        redactions: redactionResult.rows.map(row => ({
          redaction_type: row.redaction_type,
          pattern_matched: row.pattern_matched,
          timestamp: row.timestamp,
        })),
        prompt_injection_detections: piResult.rows.map(row => ({
          detection_score: row.detection_score,
          detected_patterns: row.detected_patterns,
          mitigated: row.mitigated,
          mitigation_action: row.mitigation_action,
          timestamp: row.timestamp,
        })),
        approvals: approvalResult.rows.map(row => ({
          status: row.status,
          risk_score: row.risk_score,
          requested_at: row.requested_at,
          approved_at: row.approved_at,
          rejected_at: row.rejected_at,
          approved_by: row.approved_by,
          rejection_reason: row.rejection_reason,
        })),
      };
    } catch (error) {
      logger.error('Error getting trace', { error: error.message, runId });
      throw error;
    }
  }

  /**
   * Log run creation
   */
  async logRunCreated(runId, runData, metadata) {
    await this.logEvent(runId, 'RUN_CREATED', {
      client_id: runData.client_id,
      route_path: runData.route_path,
      input_size: JSON.stringify(runData.input_data).length,
    }, metadata);
  }

  /**
   * Log policy evaluation
   */
  async logPolicyEvaluation(runId, evaluation, metadata) {
    await this.logEvent(runId, 'POLICY_EVALUATED', {
      violations: evaluation.violations,
      warnings: evaluation.warnings,
      passed: evaluation.passed,
    }, metadata);
  }

  /**
   * Log tool validation
   */
  async logToolValidation(runId, toolName, validation, metadata) {
    await this.logEvent(runId, 'TOOL_VALIDATED', {
      tool_name: toolName,
      allowed: validation.allowed,
      blocked: validation.blocked,
      reason: validation.reason,
    }, metadata);
  }

  /**
   * Log risk assessment
   */
  async logRiskAssessment(runId, riskScore, metadata) {
    await this.logEvent(runId, 'RISK_ASSESSED', {
      risk_score: riskScore,
      requires_approval: riskScore > parseFloat(process.env.REQUIRE_APPROVAL_THRESHOLD || '0.8'),
    }, metadata);
  }

  /**
   * Log completion
   */
  async logRunCompleted(runId, outputData, metadata) {
    await this.logEvent(runId, 'RUN_COMPLETED', {
      output_size: JSON.stringify(outputData).length,
      success: true,
    }, metadata);
  }

  /**
   * Log error
   */
  async logRunError(runId, error, metadata) {
    await this.logEvent(runId, 'RUN_ERROR', {
      error_message: error.message,
      error_type: error.constructor.name,
    }, metadata);
  }
}
