ALTER TABLE irrigation_zones ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_irrigation_zones_device_id ON irrigation_zones(device_id);
