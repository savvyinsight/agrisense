DROP INDEX IF EXISTS idx_alerts_correlation_id;
DROP INDEX IF EXISTS idx_alerts_snoozed_until;
ALTER TABLE alerts DROP COLUMN IF EXISTS root_cause_suggestion;
ALTER TABLE alerts DROP COLUMN IF EXISTS correlation_id;
ALTER TABLE alerts DROP COLUMN IF EXISTS snooze_reason;
ALTER TABLE alerts DROP COLUMN IF EXISTS snoozed_until;
ALTER TABLE alerts DROP COLUMN IF EXISTS flap_count;
ALTER TABLE alerts DROP COLUMN IF EXISTS is_flapping;

ALTER TABLE alert_rules DROP COLUMN IF EXISTS auto_escalation_severity;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS auto_escalation_minutes;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS auto_escalation_enabled;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS trend_condition;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS recovery_condition;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS recovery_threshold_value;
