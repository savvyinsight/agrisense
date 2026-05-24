ALTER TABLE escalation_rules DROP COLUMN IF EXISTS account_id;
ALTER TABLE notification_channels DROP COLUMN IF EXISTS account_id;
ALTER TABLE irrigation_zones DROP COLUMN IF EXISTS account_id;
ALTER TABLE fields DROP COLUMN IF EXISTS account_id;
