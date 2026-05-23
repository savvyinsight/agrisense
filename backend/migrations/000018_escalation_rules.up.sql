CREATE TABLE IF NOT EXISTS escalation_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_severity TEXT NOT NULL CHECK (trigger_severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_levels (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES escalation_rules(id) ON DELETE CASCADE,
    level_order INTEGER NOT NULL,
    delay_minutes INTEGER NOT NULL DEFAULT 15,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    channel_ids INTEGER[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS escalation_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    rule_id INTEGER NOT NULL REFERENCES escalation_rules(id) ON DELETE SET NULL,
    level_order INTEGER NOT NULL,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel_ids INTEGER[] NOT NULL DEFAULT '{}',
    notification_status JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_escalation_levels_rule_id ON escalation_levels(rule_id);
CREATE INDEX IF NOT EXISTS idx_escalation_history_alert_id ON escalation_history(alert_id);
