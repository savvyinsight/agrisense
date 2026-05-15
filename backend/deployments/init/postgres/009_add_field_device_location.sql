-- Add location columns to fields and irrigation_zones
-- These enable real map rendering instead of synthetic coordinates

ALTER TABLE fields ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE irrigation_zones ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE irrigation_zones ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
