-- Add account_id column to irrigation_events table
ALTER TABLE irrigation_events ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;

-- Create index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_irrigation_events_account_id ON irrigation_events(account_id);

-- Backfill existing rows from their parent zone's account_id
UPDATE irrigation_events e
SET account_id = z.account_id
FROM irrigation_zones z
WHERE e.zone_id = z.id AND e.account_id IS NULL;
