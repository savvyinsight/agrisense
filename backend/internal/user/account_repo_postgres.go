package user

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// PostgresAccountRepository implements AccountRepository
type PostgresAccountRepository struct {
	DB *sql.DB
}

func (r *PostgresAccountRepository) CreateAccount(account *Account) error {
	if account.MaxUsers == nil {
		defaultMax := tierDefaultMaxUsers(account.SubscriptionTier)
		account.MaxUsers = &defaultMax
	}
	if account.MaxDevices == nil {
		defaultMax := tierDefaultMaxDevices(account.SubscriptionTier)
		account.MaxDevices = &defaultMax
	}

	query := `INSERT INTO accounts (name, subscription_tier, owner_id, is_active, max_users, max_devices, created_at, updated_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

	now := time.Now()
	err := r.DB.QueryRow(query, account.Name, account.SubscriptionTier, account.OwnerID, true,
		account.MaxUsers, account.MaxDevices, now, now).Scan(&account.ID)
	return err
}

func tierDefaultMaxUsers(tier string) int {
	switch tier {
	case "professional":
		return 10
	case "enterprise":
		return 999
	default:
		return 1
	}
}

func tierDefaultMaxDevices(tier string) int {
	switch tier {
	case "professional":
		return 50
	case "enterprise":
		return 999
	default:
		return 10
	}
}

// CheckUserQuota returns an error if the account has reached its user limit
func (r *PostgresAccountRepository) CheckUserQuota(accountID int) error {
	account, err := r.GetAccountByID(accountID)
	if err != nil {
		return err
	}
	if !account.IsActive {
		return fmt.Errorf("account is inactive")
	}
	current, err := r.GetUserCountByAccount(accountID)
	if err != nil {
		return err
	}
	limit := 1
	if account.MaxUsers != nil {
		limit = *account.MaxUsers
	}
	if current >= int64(limit) {
		return fmt.Errorf("user limit reached (%d/%d)", current, limit)
	}
	return nil
}

// CheckDeviceQuota returns an error if the account has reached its device limit
func (r *PostgresAccountRepository) CheckDeviceQuota(accountID int) error {
	account, err := r.GetAccountByID(accountID)
	if err != nil {
		return err
	}
	if !account.IsActive {
		return fmt.Errorf("account is inactive")
	}
	current, err := r.GetDeviceCountByAccount(accountID)
	if err != nil {
		return err
	}
	limit := 10
	if account.MaxDevices != nil {
		limit = *account.MaxDevices
	}
	if current >= int64(limit) {
		return fmt.Errorf("device limit reached (%d/%d)", current, limit)
	}
	return nil
}

func (r *PostgresAccountRepository) GetAccountByID(accountID int) (*Account, error) {
	query := `SELECT id, name, subscription_tier, owner_id, is_active, max_users, max_devices, created_at, updated_at 
	          FROM accounts WHERE id = $1`

	var account Account
	var oid, mu, md sql.NullInt64
	err := r.DB.QueryRow(query, accountID).Scan(
		&account.ID, &account.Name, &account.SubscriptionTier, &oid,
		&account.IsActive, &mu, &md, &account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if oid.Valid {
		v := int(oid.Int64)
		account.OwnerID = &v
	}
	if mu.Valid {
		v := int(mu.Int64)
		account.MaxUsers = &v
	}
	if md.Valid {
		v := int(md.Int64)
		account.MaxDevices = &v
	}
	return &account, nil
}

func (r *PostgresAccountRepository) GetAccountsByOwnerID(ownerID int) ([]Account, error) {
	query := `SELECT id, name, subscription_tier, owner_id, is_active, max_users, max_devices, created_at, updated_at 
	          FROM accounts WHERE owner_id = $1 ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, ownerID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	accounts := make([]Account, 0)
	for rows.Next() {
		var account Account
		var oid, mu, md sql.NullInt64
		err := rows.Scan(
			&account.ID, &account.Name, &account.SubscriptionTier, &oid,
			&account.IsActive, &mu, &md, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if oid.Valid {
			v := int(oid.Int64)
			account.OwnerID = &v
		}
		if mu.Valid {
			v := int(mu.Int64)
			account.MaxUsers = &v
		}
		if md.Valid {
			v := int(md.Int64)
			account.MaxDevices = &v
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (r *PostgresAccountRepository) UpdateAccount(account *Account) error {
	query := `UPDATE accounts SET name = $1, subscription_tier = $2, is_active = $3, max_users = $4, max_devices = $5, updated_at = $6 
	          WHERE id = $7`

	_, err := r.DB.Exec(query, account.Name, account.SubscriptionTier, account.IsActive, account.MaxUsers, account.MaxDevices, time.Now(), account.ID)
	return err
}

func (r *PostgresAccountRepository) ListAllAccounts(limit, offset int) ([]Account, int64, error) {
	// Get total count
	var count int64
	countQuery := `SELECT COUNT(*) FROM accounts WHERE is_active = TRUE`
	err := r.DB.QueryRow(countQuery).Scan(&count)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated results (include inactive for admin view)
	query := `SELECT id, name, subscription_tier, owner_id, is_active, max_users, max_devices, created_at, updated_at 
	          FROM accounts ORDER BY created_at DESC LIMIT $1 OFFSET $2`

	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	accounts := make([]Account, 0)
	for rows.Next() {
		var account Account
		var oid, mu, md sql.NullInt64
		err := rows.Scan(
			&account.ID, &account.Name, &account.SubscriptionTier, &oid,
			&account.IsActive, &mu, &md, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if oid.Valid {
			v := int(oid.Int64)
			account.OwnerID = &v
		}
		if mu.Valid {
			v := int(mu.Int64)
			account.MaxUsers = &v
		}
		if md.Valid {
			v := int(md.Int64)
			account.MaxDevices = &v
		}
		accounts = append(accounts, account)
	}
	return accounts, count, rows.Err()
}

func (r *PostgresAccountRepository) GetUserCountByAccount(accountID int) (int64, error) {
	var count int64
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE account_id = $1`, accountID).Scan(&count)
	return count, err
}

func (r *PostgresAccountRepository) GetDeviceCountByAccount(accountID int) (int64, error) {
	var count int64
	err := r.DB.QueryRow(`SELECT COUNT(*) FROM devices WHERE account_id = $1`, accountID).Scan(&count)
	return count, err
}

// PostgresPermissionRepository implements PermissionRepository
type PostgresPermissionRepository struct {
	DB *sql.DB
}

func (r *PostgresPermissionRepository) CreatePermission(perm *UserPermission) error {
	query := `INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`

	err := r.DB.QueryRow(query, perm.UserID, perm.AccountID, perm.FarmID, perm.Role, perm.GrantedBy, time.Now()).
		Scan(&perm.ID)
	return err
}

func (r *PostgresPermissionRepository) GetPermissionsByUserID(userID, accountID int) ([]UserPermission, error) {
	query := `SELECT id, user_id, account_id, farm_id, role, granted_by_id, created_at 
	          FROM user_permissions WHERE user_id = $1 AND account_id = $2`

	rows, err := r.DB.Query(query, userID, accountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	permissions := make([]UserPermission, 0)
	for rows.Next() {
		var perm UserPermission
		err := rows.Scan(&perm.ID, &perm.UserID, &perm.AccountID, &perm.FarmID, &perm.Role, &perm.GrantedBy, &perm.CreatedAt)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, perm)
	}
	return permissions, rows.Err()
}

func (r *PostgresPermissionRepository) GetPermissionsByFarmID(farmID, accountID int) ([]UserPermission, error) {
	query := `SELECT id, user_id, account_id, farm_id, role, granted_by_id, created_at 
	          FROM user_permissions WHERE farm_id = $1 AND account_id = $2`

	rows, err := r.DB.Query(query, farmID, accountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	permissions := make([]UserPermission, 0)
	for rows.Next() {
		var perm UserPermission
		err := rows.Scan(&perm.ID, &perm.UserID, &perm.AccountID, &perm.FarmID, &perm.Role, &perm.GrantedBy, &perm.CreatedAt)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, perm)
	}
	return permissions, rows.Err()
}

func (r *PostgresPermissionRepository) RevokePermission(id int) error {
	query := `DELETE FROM user_permissions WHERE id = $1`
	_, err := r.DB.Exec(query, id)
	return err
}

func (r *PostgresPermissionRepository) UpdatePermission(perm *UserPermission) error {
	query := `UPDATE user_permissions SET role = $1 WHERE id = $2`
	_, err := r.DB.Exec(query, perm.Role, perm.ID)
	return err
}

func (r *PostgresPermissionRepository) HasPermission(userID, accountID int, farmID *int, role string) (bool, error) {
	var query string
	var args []interface{}

	if farmID == nil {
		// Check account-level role (farm_id IS NULL means account-wide permission)
		query = `SELECT COUNT(*) FROM user_permissions
		         WHERE user_id = $1 AND account_id = $2 AND farm_id IS NULL AND role = $3`
		args = []interface{}{userID, accountID, role}
	} else {
		// Check farm-level or account-level role
		query = `SELECT COUNT(*) FROM user_permissions 
		         WHERE user_id = $1 AND account_id = $2 AND (farm_id IS NULL OR farm_id = $3) AND role = $4`
		args = []interface{}{userID, accountID, farmID, role}
	}

	var count int
	err := r.DB.QueryRow(query, args...).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// PostgresInvitationRepository implements InvitationRepository
type PostgresInvitationRepository struct {
	DB *sql.DB
}

func (r *PostgresInvitationRepository) CreateInvitation(inv *UserInvitation) error {
	query := `INSERT INTO user_invitations 
	          (account_id, email, role, farm_id, invitation_token, invited_by_id, expires_at, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`

	err := r.DB.QueryRow(query, inv.AccountID, inv.Email, inv.Role, inv.FarmID,
		inv.InvitationToken, inv.InvitedByID, inv.ExpiresAt, time.Now()).Scan(&inv.ID)
	return err
}

func (r *PostgresInvitationRepository) GetInvitationByToken(token string) (*UserInvitation, error) {
	query := `SELECT id, account_id, email, role, farm_id, invitation_token, invited_by_id, accepted_at, 
	          accepted_by_user_id, expires_at, created_at 
	          FROM user_invitations WHERE invitation_token = $1 AND accepted_at IS NULL`

	var inv UserInvitation
	err := r.DB.QueryRow(query, token).Scan(
		&inv.ID, &inv.AccountID, &inv.Email, &inv.Role, &inv.FarmID, &inv.InvitationToken, &inv.InvitedByID,
		&inv.AcceptedAt, &inv.AcceptedByUserID, &inv.ExpiresAt, &inv.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *PostgresInvitationRepository) GetPendingInvitationsByEmail(email string) ([]UserInvitation, error) {
	query := `SELECT id, account_id, email, role, farm_id, invitation_token, invited_by_id, accepted_at, 
	          accepted_by_user_id, expires_at, created_at 
	          FROM user_invitations WHERE email = $1 AND accepted_at IS NULL AND expires_at > NOW()`

	rows, err := r.DB.Query(query, email)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	invitations := make([]UserInvitation, 0)
	for rows.Next() {
		var inv UserInvitation
		err := rows.Scan(&inv.ID, &inv.AccountID, &inv.Email, &inv.Role, &inv.FarmID, &inv.InvitationToken,
			&inv.InvitedByID, &inv.AcceptedAt, &inv.AcceptedByUserID, &inv.ExpiresAt, &inv.CreatedAt)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, rows.Err()
}

func (r *PostgresInvitationRepository) AcceptInvitation(invitationID, userID int) error {
	query := `UPDATE user_invitations SET accepted_at = $1, accepted_by_user_id = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, time.Now(), userID, invitationID)
	return err
}

func (r *PostgresInvitationRepository) ListPendingInvitations(accountID int) ([]UserInvitation, error) {
	query := `SELECT id, account_id, email, role, farm_id, invitation_token, invited_by_id, accepted_at, 
	          accepted_by_user_id, expires_at, created_at 
	          FROM user_invitations WHERE account_id = $1 AND accepted_at IS NULL AND expires_at > NOW() 
	          ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, accountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	invitations := make([]UserInvitation, 0)
	for rows.Next() {
		var inv UserInvitation
		err := rows.Scan(&inv.ID, &inv.AccountID, &inv.Email, &inv.Role, &inv.FarmID, &inv.InvitationToken,
			&inv.InvitedByID, &inv.AcceptedAt, &inv.AcceptedByUserID, &inv.ExpiresAt, &inv.CreatedAt)
		if err != nil {
			return nil, err
		}
		invitations = append(invitations, inv)
	}
	return invitations, rows.Err()
}

func (r *PostgresInvitationRepository) DeleteExpiredInvitations() error {
	query := `DELETE FROM user_invitations WHERE expires_at < NOW() AND accepted_at IS NULL`
	_, err := r.DB.Exec(query)
	return err
}

// PostgresAuditLogRepository implements AuditLogRepository
type PostgresAuditLogRepository struct {
	DB *sql.DB
}

func (r *PostgresAuditLogRepository) LogAction(log *AuditLog) error {
	query := `INSERT INTO audit_logs 
	          (account_id, user_id, action, resource_type, resource_id, resource_name, old_values, new_values, ip_address, user_agent, status, error_message, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`

	var oldB, newB []byte
	if log.OldValues != nil {
		oldB, _ = json.Marshal(log.OldValues)
	}
	if log.NewValues != nil {
		newB, _ = json.Marshal(log.NewValues)
	}

	err := r.DB.QueryRow(query, log.AccountID, log.UserID, log.Action, log.ResourceType, log.ResourceID, log.ResourceName,
		oldB, newB, log.IPAddress, log.UserAgent, log.Status, log.ErrorMessage, time.Now()).Scan(&log.ID)
	return err
}

func (r *PostgresAuditLogRepository) GetAuditLogs(accountID int, filters map[string]interface{}, limit, offset int) ([]AuditLog, int64, error) {
	query := `SELECT id, account_id, user_id, action, resource_type, resource_id, resource_name, old_values, new_values, ip_address, user_agent, status, error_message, created_at 
	          FROM audit_logs WHERE account_id = $1`
	args := []interface{}{accountID}
	argIndex := 2

	// Apply filters
	if resourceType, ok := filters["resource_type"]; ok {
		query += fmt.Sprintf(` AND resource_type = $%d`, argIndex)
		args = append(args, resourceType)
		argIndex++
	}
	if action, ok := filters["action"]; ok {
		query += fmt.Sprintf(` AND action = $%d`, argIndex)
		args = append(args, action)
		argIndex++
	}

	// Get count
	countQuery := `SELECT COUNT(*) FROM (` + query + `) cnt`
	var count int64
	err := r.DB.QueryRow(countQuery, args...).Scan(&count)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination and order
	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	logs := make([]AuditLog, 0)
	for rows.Next() {
		var log AuditLog
		var uid sql.NullInt64
		var oldB, newB []byte
		var ip, ua, em sql.NullString
		err := rows.Scan(&log.ID, &log.AccountID, &uid, &log.Action, &log.ResourceType, &log.ResourceID, &log.ResourceName,
			&oldB, &newB, &ip, &ua, &log.Status, &em, &log.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if uid.Valid {
			v := int(uid.Int64)
			log.UserID = &v
		}
		if ip.Valid {
			log.IPAddress = ip.String
		}
		if ua.Valid {
			log.UserAgent = ua.String
		}
		if em.Valid {
			log.ErrorMessage = em.String
		}
		_ = json.Unmarshal(oldB, &log.OldValues)
		_ = json.Unmarshal(newB, &log.NewValues)
		logs = append(logs, log)
	}
	return logs, count, rows.Err()
}

func (r *PostgresAuditLogRepository) GetAllAuditLogs(filters map[string]interface{}, limit, offset int) ([]AuditLog, int64, error) {
	query := `SELECT al.id, al.account_id, al.user_id, al.action, al.resource_type, al.resource_id, al.resource_name, al.old_values, al.new_values, al.ip_address, al.user_agent, al.status, al.error_message, al.created_at 
	          FROM audit_logs al`
	args := []interface{}{}
	argIndex := 1
	whereAdded := false

	if resourceType, ok := filters["resource_type"]; ok {
		if !whereAdded {
			query += ` WHERE`
			whereAdded = true
		} else {
			query += ` AND`
		}
		query += fmt.Sprintf(` al.resource_type = $%d`, argIndex)
		args = append(args, resourceType)
		argIndex++
	}
	if action, ok := filters["action"]; ok {
		if !whereAdded {
			query += ` WHERE`
			whereAdded = true
		} else {
			query += ` AND`
		}
		query += fmt.Sprintf(` al.action = $%d`, argIndex)
		args = append(args, action)
		argIndex++
	}
	if accountID, ok := filters["account_id"]; ok {
		if !whereAdded {
			query += ` WHERE`
			whereAdded = true
		} else {
			query += ` AND`
		}
		query += fmt.Sprintf(` al.account_id = $%d`, argIndex)
		args = append(args, accountID)
		argIndex++
	}

	countQuery := `SELECT COUNT(*) FROM (` + query + `) cnt`
	var count int64
	err := r.DB.QueryRow(countQuery, args...).Scan(&count)
	if err != nil {
		return nil, 0, err
	}

	query += fmt.Sprintf(` ORDER BY al.created_at DESC LIMIT $%d OFFSET $%d`, argIndex, argIndex+1)
	args = append(args, limit, offset)
	_ = whereAdded

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	logs := make([]AuditLog, 0)
	for rows.Next() {
		var log AuditLog
		var uid sql.NullInt64
		var oldB, newB []byte
		var ip, ua, em sql.NullString
		err := rows.Scan(&log.ID, &log.AccountID, &uid, &log.Action, &log.ResourceType, &log.ResourceID, &log.ResourceName,
			&oldB, &newB, &ip, &ua, &log.Status, &em, &log.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if uid.Valid {
			v := int(uid.Int64)
			log.UserID = &v
		}
		if ip.Valid {
			log.IPAddress = ip.String
		}
		if ua.Valid {
			log.UserAgent = ua.String
		}
		if em.Valid {
			log.ErrorMessage = em.String
		}
		_ = json.Unmarshal(oldB, &log.OldValues)
		_ = json.Unmarshal(newB, &log.NewValues)
		logs = append(logs, log)
	}
	return logs, count, rows.Err()
}

func (r *PostgresAuditLogRepository) GetUserAuditLogs(userID, accountID int, limit, offset int) ([]AuditLog, int64, error) {
	var count int64
	countQuery := `SELECT COUNT(*) FROM audit_logs WHERE account_id = $1 AND user_id = $2`
	err := r.DB.QueryRow(countQuery, accountID, userID).Scan(&count)
	if err != nil {
		return nil, 0, err
	}

	query := `SELECT id, account_id, user_id, action, resource_type, resource_id, resource_name, old_values, new_values, ip_address, user_agent, status, error_message, created_at
	          FROM audit_logs WHERE account_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`

	rows, err := r.DB.Query(query, accountID, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	logs := make([]AuditLog, 0)
	for rows.Next() {
		var log AuditLog
		var uid sql.NullInt64
		var oldB, newB []byte
		var ip, ua, em sql.NullString
		err := rows.Scan(&log.ID, &log.AccountID, &uid, &log.Action, &log.ResourceType, &log.ResourceID, &log.ResourceName,
			&oldB, &newB, &ip, &ua, &log.Status, &em, &log.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		if uid.Valid {
			v := int(uid.Int64)
			log.UserID = &v
		}
		if ip.Valid {
			log.IPAddress = ip.String
		}
		if ua.Valid {
			log.UserAgent = ua.String
		}
		if em.Valid {
			log.ErrorMessage = em.String
		}
		_ = json.Unmarshal(oldB, &log.OldValues)
		_ = json.Unmarshal(newB, &log.NewValues)
		logs = append(logs, log)
	}
	return logs, count, rows.Err()
}
