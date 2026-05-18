ALTER TABLE irrigation_zones DROP COLUMN IF EXISTS latitude;
ALTER TABLE irrigation_zones DROP COLUMN IF EXISTS longitude;
ALTER TABLE fields DROP COLUMN IF EXISTS latitude;
ALTER TABLE fields DROP COLUMN IF EXISTS longitude;
