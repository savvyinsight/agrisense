ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_users INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_devices INTEGER;

UPDATE accounts SET max_users = 1, max_devices = 10 WHERE max_users IS NULL AND subscription_tier = 'basic';
UPDATE accounts SET max_users = 10, max_devices = 50 WHERE max_users IS NULL AND subscription_tier = 'professional';
UPDATE accounts SET max_users = 999, max_devices = 999 WHERE max_users IS NULL AND subscription_tier = 'enterprise';

COMMENT ON COLUMN accounts.max_users IS 'Maximum number of users allowed. NULL = use tier default.';
COMMENT ON COLUMN accounts.max_devices IS 'Maximum number of devices allowed. NULL = use tier default.';
