ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_alert_rules_field_id ON alert_rules(field_id);
