ALTER TABLE irrigation_events ALTER COLUMN account_id DROP NOT NULL;

DROP INDEX IF EXISTS idx_irrigation_events_account_id;
ALTER TABLE irrigation_events DROP COLUMN IF EXISTS account_id;
