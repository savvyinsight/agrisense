-- Add field_id to alert_rules to allow scoping rules to all devices in a field
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id) ON DELETE CASCADE;

-- Index for field_id lookups in rule evaluation
CREATE INDEX IF NOT EXISTS idx_alert_rules_field_id ON alert_rules(field_id);
