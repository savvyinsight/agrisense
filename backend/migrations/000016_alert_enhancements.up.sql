ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS recovery_threshold_value DOUBLE PRECISION;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS recovery_condition TEXT;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS trend_condition JSONB;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS auto_escalation_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS auto_escalation_minutes INTEGER;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS auto_escalation_severity TEXT;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS is_flapping BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS flap_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS snooze_reason TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS root_cause_suggestion TEXT;

CREATE INDEX IF NOT EXISTS idx_alerts_snoozed_until ON alerts(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_correlation_id ON alerts(correlation_id) WHERE correlation_id IS NOT NULL;
