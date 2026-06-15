-- Add geometry JSONB column to fields table for storing polygon coordinates

ALTER TABLE fields ADD COLUMN IF NOT EXISTS geometry JSONB;
