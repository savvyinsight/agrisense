-- Additional indexes for query performance

-- Composite indexes for common queries
CREATE INDEX idx_devices_user_status ON devices(user_id, status);
CREATE INDEX idx_alerts_device_triggered ON alerts(device_id, triggered_at DESC);
CREATE INDEX idx_commands_device_created ON control_commands(device_id, created_at DESC);

-- Partial index for active alerts
CREATE INDEX idx_alerts_active ON alerts(status) WHERE status = 'triggered';

-- GiST index for timestamp ranges (if using range queries)
-- CREATE INDEX idx_alerts_triggered_range ON alerts USING GiST (triggered_at);
