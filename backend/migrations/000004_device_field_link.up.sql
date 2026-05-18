ALTER TABLE devices ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES fields(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_devices_field_id ON devices(field_id);
