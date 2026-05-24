-- Add account_id to fields (required, backfilled from users)
ALTER TABLE fields ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
UPDATE fields SET account_id = u.account_id FROM users u WHERE fields.user_id = u.id AND fields.account_id IS NULL;
ALTER TABLE fields ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_account_id ON fields(account_id);

-- Add account_id to irrigation_zones (required, backfilled from users)
ALTER TABLE irrigation_zones ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
UPDATE irrigation_zones SET account_id = u.account_id FROM users u WHERE irrigation_zones.user_id = u.id AND irrigation_zones.account_id IS NULL;
ALTER TABLE irrigation_zones ALTER COLUMN account_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_irrigation_zones_account_id ON irrigation_zones(account_id);

-- Add account_id to notification_channels (nullable for now - global channels)
ALTER TABLE notification_channels ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notification_channels_account_id ON notification_channels(account_id);

-- Add account_id to escalation_rules (nullable for now - global rules)
ALTER TABLE escalation_rules ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_escalation_rules_account_id ON escalation_rules(account_id);
