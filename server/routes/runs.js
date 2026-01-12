import express from 'express';
import { db } from '../db/connection.js';
import { PolicyEngine } from '../core/PolicyEngine.js';
import { ToolFirewall } from '../core/ToolFirewall.js';
import { AuditTrail } from '../core/AuditTrail.js';
import { createLogger } from '../utils/logger.js';
import axios from 'axios';

const router = express.Router();
const logger = createLogger();
const policyEngine = new PolicyEngine();
const toolFirewall = new ToolFirewall();
const auditTrail = new AuditTrail();

router.get('/', async (req, res, next) => {
  try {
    const { client_id, status, limit = 100 } = req.query;

    let query = 'SELECT * FROM runs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (client_id) {
      query += ` AND client_id = $${paramCount++}`;
      params.push(client_id);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json({
      runs: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { client_id, route_path, input_data, context, tools, model_name, model_version, prompt_version } = req.body;

    if (!client_id || !route_path || !input_data) {
      return res.status(400).json({
        error: 'Missing required fields: client_id, route_path, input_data',
      });
    }

    const policy = await policyEngine.getPolicy(client_id, route_path);

    const runResult = await db.query(
      `INSERT INTO runs (
        client_id, route_path, policy_id, input_data, context, tools,
        model_name, model_version, prompt_version, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        client_id,
        route_path,
        policy.id,
        JSON.stringify(input_data),
        context ? JSON.stringify(context) : null,
        tools ? JSON.stringify(tools) : null,
        model_name || 'default',
        model_version || '1.0',
        prompt_version || '1.0',
      ]
    );

    const run = runResult.rows[0];
    const runId = run.id;

    await auditTrail.logRunCreated(runId, { client_id, route_path, input_data }, {
      policyVersion: policy.version,
      promptVersion: prompt_version,
      modelVersion: model_version,
    });

    const policyEvaluation = await policyEngine.evaluatePolicy(policy, {
      input_data,
      context,
      tools,
    });

    await auditTrail.logPolicyEvaluation(runId, policyEvaluation, {
      policyVersion: policy.version,
    });

    if (!policyEvaluation.passed) {
      await db.query(
        `UPDATE runs SET status = 'blocked', error_message = $1 WHERE id = $2`,
        [
          `Policy violations: ${policyEvaluation.violations.map(v => v.message).join('; ')}`,
          runId,
        ]
      );
      return res.status(403).json({
        run_id: runId,
        status: 'blocked',
        violations: policyEvaluation.violations,
        warnings: policyEvaluation.warnings,
      });
    }

    let maxRiskScore = 0.0;
    const toolValidations = [];

    if (tools && Array.isArray(tools)) {
      for (const tool of tools) {
        const validation = toolFirewall.validateToolExecution(
          tool.name,
          tool.params || {},
          policy
        );

        const riskScore = toolFirewall.calculateRiskScore(
          tool.name,
          tool.params || {},
          policy
        );

        maxRiskScore = Math.max(maxRiskScore, riskScore);

        await auditTrail.logToolValidation(runId, tool.name, validation, {
          policyVersion: policy.version,
        });

        await db.query(
          `INSERT INTO tool_executions (
            run_id, tool_name, tool_params, allowed, blocked_reason
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            runId,
            tool.name,
            JSON.stringify(tool.params || {}),
            validation.allowed,
            validation.reason,
          ]
        );

        toolValidations.push({
          tool_name: tool.name,
          allowed: validation.allowed,
          blocked: validation.blocked,
          reason: validation.reason,
          risk_score: riskScore,
        });

        if (!validation.allowed) {
          await db.query(
            `UPDATE runs SET status = 'blocked', error_message = $1 WHERE id = $2`,
            [`Tool ${tool.name} blocked: ${validation.reason}`, runId]
          );
          return res.status(403).json({
            run_id: runId,
            status: 'blocked',
            tool_validations: toolValidations,
          });
        }
      }
    }

    let processedInput = input_data;
    if (policy.data_redaction_enabled) {
      try {
        const redactionResponse = await axios.post(
          `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/redact`,
          { data: input_data }
        );
        processedInput = redactionResponse.data.redacted_data;
      } catch (error) {
        logger.warn('Redaction service unavailable', { error: error.message });
      }
    }

    let promptInjectionScore = 0.0;
    if (policy.prompt_injection_shield) {
      try {
        const piResponse = await axios.post(
          `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/detect-prompt-injection`,
          { text: JSON.stringify(processedInput) }
        );
        promptInjectionScore = piResponse.data.detection_score || 0.0;

        if (promptInjectionScore > 0.7) {
          await db.query(
            `INSERT INTO prompt_injection_detections (
              run_id, detection_score, detected_patterns, input_text, mitigated
            ) VALUES ($1, $2, $3, $4, true)`,
            [
              runId,
              promptInjectionScore,
              piResponse.data.detected_patterns || [],
              JSON.stringify(processedInput).substring(0, 1000),
            ]
          );

          await db.query(
            `UPDATE runs SET status = 'blocked', error_message = $1 WHERE id = $2`,
            [`Prompt injection detected (score: ${promptInjectionScore})`, runId]
          );
          return res.status(403).json({
            run_id: runId,
            status: 'blocked',
            reason: 'Prompt injection detected',
            detection_score: promptInjectionScore,
          });
        }
      } catch (error) {
        logger.warn('Prompt injection detection service unavailable', { error: error.message });
      }
    }

    const finalRiskScore = Math.max(maxRiskScore, promptInjectionScore);
    const requiresApproval = finalRiskScore > parseFloat(policy.max_risk_score || process.env.REQUIRE_APPROVAL_THRESHOLD || '0.8');

    await db.query(
      `UPDATE runs SET risk_score = $1, requires_approval = $2 WHERE id = $3`,
      [finalRiskScore, requiresApproval, runId]
    );

    await auditTrail.logRiskAssessment(runId, finalRiskScore, {
      policyVersion: policy.version,
    });

    if (requiresApproval) {
      await db.query(
        `INSERT INTO approvals (
          run_id, risk_score, status, approval_data
        ) VALUES ($1, $2, 'pending', $3)`,
        [
          runId,
          finalRiskScore,
          JSON.stringify({ input_data: processedInput, tools }),
        ]
      );

      await db.query(
        `UPDATE runs SET status = 'pending_approval' WHERE id = $1`,
        [runId]
      );

      return res.status(202).json({
        run_id: runId,
        status: 'pending_approval',
        risk_score: finalRiskScore,
        message: 'Approval required before execution',
      });
    }

    try {
      await db.query(
        `UPDATE runs SET status = 'processing' WHERE id = $1`,
        [runId]
      );

      const outputData = {
        result: 'Execution completed',
        processed_input: processedInput,
      };

      await db.query(
        `UPDATE runs SET 
          status = 'completed', 
          output_data = $1, 
          completed_at = NOW() 
        WHERE id = $2`,
        [JSON.stringify(outputData), runId]
      );

      await auditTrail.logRunCompleted(runId, outputData, {
        policyVersion: policy.version,
      });

      res.status(200).json({
        run_id: runId,
        status: 'completed',
        output_data: outputData,
        risk_score: finalRiskScore,
      });
    } catch (error) {
      await db.query(
        `UPDATE runs SET status = 'error', error_message = $1 WHERE id = $2`,
        [error.message, runId]
      );

      await auditTrail.logRunError(runId, error, {
        policyVersion: policy.version,
      });

      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
