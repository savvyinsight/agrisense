UPDATE devices d
SET account_id = u.account_id
FROM users u
WHERE d.user_id = u.id
  AND d.account_id IS NULL
  AND u.account_id IS NOT NULL;

UPDATE alert_rules ar
SET account_id = u.account_id
FROM users u
WHERE ar.user_id = u.id
  AND ar.account_id IS NULL
  AND u.account_id IS NOT NULL;

UPDATE automation_rules ar
SET account_id = u.account_id
FROM users u
WHERE ar.user_id = u.id
  AND ar.account_id IS NULL
  AND u.account_id IS NOT NULL;
