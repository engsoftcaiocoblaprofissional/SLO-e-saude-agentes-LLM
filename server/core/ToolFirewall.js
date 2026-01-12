import { createLogger } from '../utils/logger.js';
import { z } from 'zod';

const logger = createLogger();

export class ToolFirewall {
  validateToolExecution(toolName, toolParams, policy) {
    const result = {
      allowed: true,
      blocked: false,
      reason: null,
      warnings: [],
    };

    if (policy.tool_whitelist && policy.tool_whitelist.length > 0) {
      if (!policy.tool_whitelist.includes(toolName)) {
        result.allowed = false;
        result.blocked = true;
        result.reason = `Tool ${toolName} not in whitelist`;
        return result;
      }
    }

    if (policy.tool_blacklist && policy.tool_blacklist.includes(toolName)) {
      result.allowed = false;
      result.blocked = true;
      result.reason = `Tool ${toolName} is blacklisted`;
      return result;
    }

    const toolRules = policy.rules?.tools?.[toolName];
    if (toolRules) {
      if (toolRules.allowedParams) {
        const invalidParams = Object.keys(toolParams).filter(
          param => !toolRules.allowedParams.includes(param)
        );
        if (invalidParams.length > 0) {
          result.allowed = false;
          result.blocked = true;
          result.reason = `Invalid parameters: ${invalidParams.join(', ')}`;
          return result;
        }
      }

      if (toolRules.maxAmount && toolParams.amount) {
        if (parseFloat(toolParams.amount) > toolRules.maxAmount) {
          result.allowed = false;
          result.blocked = true;
          result.reason = `Amount ${toolParams.amount} exceeds maximum ${toolRules.maxAmount}`;
          return result;
        }
      }

      if (toolRules.destructive && !toolRules.allowDestructive) {
        result.allowed = false;
        result.blocked = true;
        result.reason = `Destructive operation not allowed`;
        return result;
      }

      if (toolRules.schema) {
        try {
          const schema = z.object(toolRules.schema);
          schema.parse(toolParams);
        } catch (error) {
          result.allowed = false;
          result.blocked = true;
          result.reason = `Schema validation failed: ${error.message}`;
          return result;
        }
      }
    }

    const dangerousPatterns = this.checkDangerousPatterns(toolName, toolParams);
    if (dangerousPatterns.length > 0) {
      result.warnings.push(...dangerousPatterns);
      if (dangerousPatterns.some(p => p.severity === 'high')) {
        result.allowed = false;
        result.blocked = true;
        result.reason = `Dangerous pattern detected: ${dangerousPatterns[0].message}`;
        return result;
      }
    }

    return result;
  }

  checkDangerousPatterns(toolName, toolParams) {
    const warnings = [];

    if (toolName.toLowerCase().includes('delete') || 
        toolName.toLowerCase().includes('remove') ||
        toolName.toLowerCase().includes('drop')) {
      warnings.push({
        type: 'DESTRUCTIVE_OPERATION',
        message: 'Potentially destructive operation detected',
        severity: 'high',
      });
    }

    if (toolName.toLowerCase().includes('transfer') && toolParams.amount) {
      const amount = parseFloat(toolParams.amount);
      if (amount > 10000) {
        warnings.push({
          type: 'HIGH_AMOUNT_TRANSFER',
          message: `High amount transfer detected: ${amount}`,
          severity: 'high',
        });
      }
    }

    if (toolName.toLowerCase().includes('file') || 
        toolName.toLowerCase().includes('write')) {
      if (toolParams.path && !toolParams.path.startsWith('/safe/')) {
        warnings.push({
          type: 'UNSAFE_FILE_OPERATION',
          message: 'File operation outside safe directory',
          severity: 'medium',
        });
      }
    }

    if (toolName.toLowerCase().includes('http') || 
        toolName.toLowerCase().includes('request')) {
      if (toolParams.url && !this.isSafeUrl(toolParams.url)) {
        warnings.push({
          type: 'UNSAFE_NETWORK_OPERATION',
          message: 'Network operation to potentially unsafe URL',
          severity: 'medium',
        });
      }
    }

    return warnings;
  }

  isSafeUrl(url) {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'localhost' || 
          urlObj.hostname.startsWith('127.') ||
          urlObj.hostname.startsWith('192.168.') ||
          urlObj.hostname.startsWith('10.') ||
          urlObj.hostname.startsWith('172.')) {
        return false;
      }
      if (urlObj.protocol !== 'https:') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  calculateRiskScore(toolName, toolParams, policy) {
    let riskScore = 0.0;

    if (toolName.toLowerCase().includes('delete') || 
        toolName.toLowerCase().includes('remove')) {
      riskScore += 0.4;
    }

    if (toolName.toLowerCase().includes('transfer') || 
        toolName.toLowerCase().includes('payment')) {
      riskScore += 0.3;
    }

    if (toolParams.amount) {
      const amount = parseFloat(toolParams.amount);
      if (amount > 1000) riskScore += 0.2;
      if (amount > 10000) riskScore += 0.3;
    }

    const paramRisk = this.assessParameterRisk(toolParams);
    riskScore += paramRisk;

    return Math.min(riskScore, 1.0);
  }

  assessParameterRisk(params) {
    let risk = 0.0;
    const paramStr = JSON.stringify(params);
    const sensitivePatterns = [
      /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
      /password|secret|key|token/i,
    ];

    sensitivePatterns.forEach(pattern => {
      if (pattern.test(paramStr)) {
        risk += 0.1;
      }
    });

    return Math.min(risk, 0.3);
  }
}
