DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_invitations CASCADE;
DROP TABLE IF EXISTS user_permissions CASCADE;

ALTER TABLE control_commands DROP COLUMN IF EXISTS account_id;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS account_id;
ALTER TABLE alerts DROP COLUMN IF EXISTS account_id;
ALTER TABLE alert_rules DROP COLUMN IF EXISTS account_id;
ALTER TABLE devices DROP COLUMN IF EXISTS account_id;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'viewer'));

ALTER TABLE users DROP COLUMN IF EXISTS account_id;

DROP TABLE IF EXISTS accounts CASCADE;
