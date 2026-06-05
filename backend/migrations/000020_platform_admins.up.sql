-- Migration: Create platform_admins table

CREATE TABLE IF NOT EXISTS platform_admins (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note TEXT,
    UNIQUE(user_id)
);

-- Backfill: if no platform_admins exist, promote the first user with role='admin' (if any)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM platform_admins) = 0 THEN
        INSERT INTO platform_admins (user_id)
        SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1;
    END IF;
END$$;
