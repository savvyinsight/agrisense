-- Allow devices to be created without a user (auto-registered, unclaimed)
ALTER TABLE devices ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE devices ALTER COLUMN user_id DROP DEFAULT;
