-- Add metadata columns that were omitted from original schema
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE control_commands ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
