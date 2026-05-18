CREATE TABLE IF NOT EXISTS fields (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    crop VARCHAR(100),
    area_hectares DOUBLE PRECISION,
    health VARCHAR(20) DEFAULT 'healthy' CHECK (health IN ('healthy', 'warning', 'critical')),
    soil_moisture DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    last_irrigation TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS irrigation_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    moisture DOUBLE PRECISION DEFAULT 0,
    target_moisture DOUBLE PRECISION DEFAULT 60,
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('active', 'scheduled', 'idle', 'failed')),
    runtime_minutes INTEGER DEFAULT 0,
    flow_rate_lpm DOUBLE PRECISION DEFAULT 0,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fields_user_id ON fields(user_id);
CREATE INDEX IF NOT EXISTS idx_irrigation_zones_field_id ON irrigation_zones(field_id);
