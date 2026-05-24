DROP TABLE IF EXISTS automation_global_settings;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS metadata;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS last_command_status;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS execution_count;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS last_triggered_at;
ALTER TABLE automation_rules DROP COLUMN IF EXISTS paused;
