ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS execution_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS last_command_status TEXT;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS automation_global_settings (
    id SERIAL PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO automation_global_settings (enabled) VALUES (TRUE);
