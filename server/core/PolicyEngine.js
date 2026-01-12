import { db } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export class PolicyEngine {
  async getPolicy(clientId, routePath) {
    try {
      const result = await db.query(
        `SELECT * FROM policies 
         WHERE (client_id = $1 OR client_id IS NULL)
           AND (route_path = $2 OR route_path IS NULL)
           AND active = true
         ORDER BY client_id NULLS LAST, route_path NULLS LAST
         LIMIT 1`,
        [clientId, routePath]
      );

      if (result.rows.length === 0) {
        return this.getDefaultPolicy();
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting policy', { error: error.message, clientId, routePath });
      return this.getDefaultPolicy();
    }
  }

  getDefaultPolicy() {
    return {
      id: null,
      name: 'default',
      rules: {
        allowPII: false,
        allowInternalData: false,
        allowedLanguages: ['pt-BR', 'en'],
        maxTokens: 4000,
        maxCost: 1.0,
      },
      tool_whitelist: [],
      tool_blacklist: [],
      max_risk_score: parseFloat(process.env.DEFAULT_RISK_THRESHOLD || '0.7'),
      require_approval: false,
      data_redaction_enabled: true,
      prompt_injection_shield: true,
    };
  }

  async evaluatePolicy(policy, runData) {
    const violations = [];
    const warnings = [];

    if (!policy.rules.allowPII && this.containsPII(runData.input_data)) {
      violations.push({
        type: 'PII_DETECTED',
        message: 'PII detected but not allowed by policy',
        severity: 'high',
      });
    }

    if (!policy.rules.allowInternalData && this.containsInternalData(runData.input_data)) {
      violations.push({
        type: 'INTERNAL_DATA_DETECTED',
        message: 'Internal data detected but not allowed by policy',
        severity: 'medium',
      });
    }

    if (policy.rules.allowedLanguages && policy.rules.allowedLanguages.length > 0) {
      const detectedLanguage = this.detectLanguage(runData.input_data);
      if (!policy.rules.allowedLanguages.includes(detectedLanguage)) {
        warnings.push({
          type: 'LANGUAGE_NOT_ALLOWED',
          message: `Language ${detectedLanguage} not in allowed list`,
          severity: 'low',
        });
      }
    }

    // Check token limits
    if (policy.rules.maxTokens) {
      const estimatedTokens = this.estimateTokens(runData.input_data);
      if (estimatedTokens > policy.rules.maxTokens) {
        violations.push({
          type: 'TOKEN_LIMIT_EXCEEDED',
          message: `Estimated tokens ${estimatedTokens} exceeds limit ${policy.rules.maxTokens}`,
          severity: 'medium',
        });
      }
    }

    return {
      violations,
      warnings,
      passed: violations.length === 0,
    };
  }

  containsPII(data) {
    const piiPatterns = [
      /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
      /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /\b\d{3}-\d{2}-\d{4}\b/,
    ];

    const dataStr = JSON.stringify(data);
    return piiPatterns.some(pattern => pattern.test(dataStr));
  }

  containsInternalData(data) {
    const internalMarkers = [
      'internal',
      'confidential',
      'proprietary',
      'secret',
      'restricted',
    ];

    const dataStr = JSON.stringify(data).toLowerCase();
    return internalMarkers.some(marker => dataStr.includes(marker));
  }

  detectLanguage(data) {
    const dataStr = JSON.stringify(data);
    const ptChars = (dataStr.match(/[áàâãéêíóôõúç]/gi) || []).length;
    const totalChars = dataStr.length;
    
    if (ptChars / totalChars > 0.01) {
      return 'pt-BR';
    }
    return 'en';
  }

  estimateTokens(data) {
    const dataStr = JSON.stringify(data);
    return Math.ceil(dataStr.length / 4);
  }

  async createOrUpdatePolicy(policyData) {
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
      } = policyData;

      const existing = await db.query(
        `SELECT id, version FROM policies 
         WHERE name = $1 AND client_id = $2 AND route_path = $3 AND active = true`,
        [name, client_id, route_path]
      );

      if (existing.rows.length > 0) {
        const newVersion = existing.rows[0].version + 1;
        await db.query(
          `UPDATE policies SET active = false WHERE id = $1`,
          [existing.rows[0].id]
        );
      }

      const result = await db.query(
        `INSERT INTO policies (
          name, client_id, route_path, rules, tool_whitelist, tool_blacklist,
          max_risk_score, require_approval, data_redaction_enabled, 
          prompt_injection_shield, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          name,
          client_id,
          route_path,
          JSON.stringify(rules || {}),
          tool_whitelist || [],
          tool_blacklist || [],
          max_risk_score || 0.8,
          require_approval || false,
          data_redaction_enabled !== false,
          prompt_injection_shield !== false,
          existing.rows.length > 0 ? existing.rows[0].version + 1 : 1,
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating/updating policy', { error: error.message, policyData });
      throw error;
    }
  }
}
