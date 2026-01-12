-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    client_id VARCHAR(255),
    route_path VARCHAR(255),
    rules JSONB NOT NULL DEFAULT '{}',
    tool_whitelist TEXT[],
    tool_blacklist TEXT[],
    max_risk_score DECIMAL(3,2) DEFAULT 0.8,
    require_approval BOOLEAN DEFAULT false,
    data_redaction_enabled BOOLEAN DEFAULT true,
    prompt_injection_shield BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true
);

CREATE INDEX idx_policies_client_route ON policies(client_id, route_path);
CREATE INDEX idx_policies_active ON policies(active);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) NOT NULL,
    route_path VARCHAR(255) NOT NULL,
    policy_id UUID REFERENCES policies(id),
    input_data JSONB NOT NULL,
    context JSONB,
    tools JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    risk_score DECIMAL(3,2),
    requires_approval BOOLEAN DEFAULT false,
    approved BOOLEAN,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    output_data JSONB,
    error_message TEXT,
    model_name VARCHAR(255),
    model_version VARCHAR(100),
    prompt_version VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_runs_client ON runs(client_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created ON runs(created_at);
CREATE INDEX idx_runs_risk ON runs(risk_score);

-- Audit trail table
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    policy_version INTEGER,
    prompt_version VARCHAR(100),
    model_version VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(255),
    ip_address INET
);

CREATE INDEX idx_audit_run ON audit_trail(run_id);
CREATE INDEX idx_audit_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_event_type ON audit_trail(event_type);

-- Tool executions table
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    tool_name VARCHAR(255) NOT NULL,
    tool_params JSONB NOT NULL,
    allowed BOOLEAN NOT NULL,
    blocked_reason TEXT,
    executed BOOLEAN DEFAULT false,
    execution_result JSONB,
    execution_error TEXT,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tool_executions_run ON tool_executions(run_id);
CREATE INDEX idx_tool_executions_tool ON tool_executions(tool_name);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    approved_by VARCHAR(255),
    rejection_reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    risk_score DECIMAL(3,2) NOT NULL,
    approval_data JSONB
);

CREATE INDEX idx_approvals_run ON approvals(run_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- Eval runs table
CREATE TABLE IF NOT EXISTS eval_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    dataset_path TEXT,
    policy_id UUID REFERENCES policies(id),
    status VARCHAR(50) DEFAULT 'pending',
    results JSONB,
    scores JSONB,
    passed BOOLEAN,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_eval_runs_status ON eval_runs(status);
CREATE INDEX idx_eval_runs_created ON eval_runs(created_at);

-- Metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL,
    client_id VARCHAR(255),
    route_path VARCHAR(255),
    value DECIMAL(10,4) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_type ON metrics(metric_type);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_client ON metrics(client_id);

-- SLO metrics table
CREATE TABLE IF NOT EXISTS slo_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_slo_metrics_client ON slo_metrics(client_id);
CREATE INDEX idx_slo_metrics_name ON slo_metrics(metric_name);
CREATE INDEX idx_slo_metrics_window ON slo_metrics(window_start, window_end);

-- Redaction logs table
CREATE TABLE IF NOT EXISTS redaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    redaction_type VARCHAR(100) NOT NULL,
    original_value TEXT,
    redacted_value TEXT,
    pattern_matched VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_redaction_logs_run ON redaction_logs(run_id);

-- Prompt injection detections table
CREATE TABLE IF NOT EXISTS prompt_injection_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    detection_score DECIMAL(3,2) NOT NULL,
    detected_patterns TEXT[],
    input_text TEXT,
    mitigated BOOLEAN DEFAULT false,
    mitigation_action VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pi_detections_run ON prompt_injection_detections(run_id);
CREATE INDEX idx_pi_detections_score ON prompt_injection_detections(detection_score);
