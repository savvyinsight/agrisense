CREATE TABLE IF NOT EXISTS notification_channels (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'webhook')),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_routing_rules (
    id SERIAL PRIMARY KEY,
    severity TEXT NOT NULL UNIQUE CHECK (severity IN ('info', 'warning', 'critical')),
    channel_ids INTEGER[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_routing_rules (severity, channel_ids) VALUES
    ('critical', '{}'),
    ('warning', '{}'),
    ('info', '{}');
