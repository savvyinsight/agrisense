CREATE TABLE IF NOT EXISTS irrigation_events (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES irrigation_zones(id) ON DELETE CASCADE,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP,
    duration_minutes INTEGER DEFAULT 0,
    water_usage_liters DOUBLE PRECISION DEFAULT 0,
    trigger_type VARCHAR(20) DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'schedule', 'rule')),
    triggered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_irrigation_events_zone_id ON irrigation_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_events_field_id ON irrigation_events(field_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_events_status ON irrigation_events(status);
