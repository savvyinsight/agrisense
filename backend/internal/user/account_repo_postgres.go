package user

import (
	"database/sql"
	"fmt"
	"time"
)

// PostgresAccountRepository implements AccountRepository
type PostgresAccountRepository struct {
	DB *sql.DB
}

func (r *PostgresAccountRepository) CreateAccount(account *Account) error {
	query := `INSERT INTO accounts (name, subscription_tier, owner_id, is_active, created_at, updated_at)
	          VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	
	now := time.Now()
	err := r.DB.QueryRow(query, account.Name, account.SubscriptionTier, account.OwnerID, true, now, now).
		Scan(&account.ID)
	return err
}

func (r *PostgresAccountRepository) GetAccountByID(accountID int) (*Account, error) {
	query := `SELECT id, name, subscription_tier, owner_id, is_active, created_at, updated_at 
	          FROM accounts WHERE id = $1`
	
	var account Account
	err := r.DB.QueryRow(query, accountID).Scan(
		&account.ID, &account.Name, &account.SubscriptionTier, &account.OwnerID, 
		&account.IsActive, &account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func (r *PostgresAccountRepository) GetAccountsByOwnerID(ownerID int) ([]Account, error) {
	query := `SELECT id, name, subscription_tier, owner_id, is_active, created_at, updated_at 
	          FROM accounts WHERE owner_id = $1 ORDER BY created_at DESC`
	
	rows, err := r.DB.Query(query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var accounts []Account
	for rows.Next() {
		var account Account
		err := rows.Scan(
			&account.ID, &account.Name, &account.SubscriptionTier, &account.OwnerID, 
			&account.IsActive, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (r *PostgresAccountRepository) UpdateAccount(account *Account) error {
	query := `UPDATE accounts SET name = $1, subscription_tier = $2, is_active = $3, updated_at = $4 
	          WHERE id = $5`
	
	_, err := r.DB.Exec(query, account.Name, account.SubscriptionTier, account.IsActive, time.Now(), account.ID)
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
	
	// Get paginated results
	query := `SELECT id, name, subscription_tier, owner_id, is_active, created_at, updated_at 
	          FROM accounts WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2`
	
	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	
	var accounts []Account
	for rows.Next() {
		var account Account
		err := rows.Scan(
			&account.ID, &account.Name, &account.SubscriptionTier, &account.OwnerID,
			&account.IsActive, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		accounts = append(accounts, account)
	}
	return accounts, count, rows.Err()
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
	defer rows.Close()
	
	var permissions []UserPermission
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
	defer rows.Close()
	
	var permissions []UserPermission
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
		// Check account-level role
		query = `SELECT COUNT(*) FROM user_permissions 
		         WHERE user_id = $1 AND account_id = $2 AND (farm_id IS NULL OR farm_id = $3) AND role = $4`
		args = []interface{}{userID, accountID, nil, role}
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
	defer rows.Close()
	
	var invitations []UserInvitation
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
	defer rows.Close()
	
	var invitations []UserInvitation
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
	
	err := r.DB.QueryRow(query, log.AccountID, log.UserID, log.Action, log.ResourceType, log.ResourceID, log.ResourceName,
		log.OldValues, log.NewValues, log.IPAddress, log.UserAgent, log.Status, log.ErrorMessage, time.Now()).Scan(&log.ID)
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
	countQuery := query
	var count int64
	err := r.DB.QueryRow(countQuery, args[:len(args)]...).Scan(&count)
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
	defer rows.Close()
	
	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(&log.ID, &log.AccountID, &log.UserID, &log.Action, &log.ResourceType, &log.ResourceID, &log.ResourceName,
			&log.OldValues, &log.NewValues, &log.IPAddress, &log.UserAgent, &log.Status, &log.ErrorMessage, &log.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}
	return logs, count, rows.Err()
}

func (r *PostgresAuditLogRepository) GetUserAuditLogs(userID, accountID int, limit, offset int) ([]AuditLog, int64, error) {
	// Get count
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
	defer rows.Close()
	
	var logs []AuditLog
	for rows.Next() {
		var log AuditLog
		err := rows.Scan(&log.ID, &log.AccountID, &log.UserID, &log.Action, &log.ResourceType, &log.ResourceID, &log.ResourceName,
			&log.OldValues, &log.NewValues, &log.IPAddress, &log.UserAgent, &log.Status, &log.ErrorMessage, &log.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		logs = append(logs, log)
	}
	return logs, count, rows.Err()
}
