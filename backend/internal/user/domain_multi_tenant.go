package user

import (
	"time"
)

// Account represents a subscription customer (farm business)
type Account struct {
	ID                int       `json:"id"`
	Name              string    `json:"name"`
	SubscriptionTier  string    `json:"subscription_tier"` // basic, professional, enterprise
	OwnerID           int       `json:"owner_id"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// User represents an individual person
type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // excluded from JSON
	Role      string    `json:"role"` // DEPRECATED - use UserPermission instead
	AccountID *int      `json:"account_id"` // NULL for system users
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserPermission represents granular role assignment
// A user can have different roles in different farms within their account
type UserPermission struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	AccountID int       `json:"account_id"`
	FarmID    *int      `json:"farm_id"` // NULL = applies to all farms; SET = specific farm
	Role      string    `json:"role"`    // account_owner, farm_manager, operator, technician
	GrantedBy int       `json:"granted_by_id"`
	CreatedAt time.Time `json:"created_at"`
}

// Role constants
const (
	RoleAccountOwner = "account_owner"
	RoleFarmManager  = "farm_manager"
	RoleOperator     = "operator"
	RoleTechnician   = "technician"

	// Legacy roles (deprecated)
	RoleAdmin  = "admin"
	RoleViewer = "viewer"
)

// UserInvitation represents a pending user invitation
type UserInvitation struct {
	ID               int       `json:"id"`
	AccountID        int       `json:"account_id"`
	Email            string    `json:"email"`
	Role             string    `json:"role"`
	FarmID           *int      `json:"farm_id"` // optional - restrict to specific farm
	InvitationToken  string    `json:"invitation_token"`
	InvitedByID      int       `json:"invited_by_id"`
	AcceptedAt       *time.Time `json:"accepted_at"` // NULL if not yet accepted
	AcceptedByUserID *int      `json:"accepted_by_user_id"`
	ExpiresAt        time.Time `json:"expires_at"`
	CreatedAt        time.Time `json:"created_at"`
}

// AuditLog represents an audit trail entry
type AuditLog struct {
	ID           int       `json:"id"`
	AccountID    int       `json:"account_id"`
	UserID       *int      `json:"user_id"` // NULL if system action
	Action       string    `json:"action"` // create, read, update, delete
	ResourceType string    `json:"resource_type"` // user, device, alert, etc.
	ResourceID   string    `json:"resource_id"`
	ResourceName string    `json:"resource_name"`
	OldValues    map[string]interface{} `json:"old_values"` // JSONB in DB
	NewValues    map[string]interface{} `json:"new_values"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	Status       string    `json:"status"` // success, failure
	ErrorMessage string    `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserRepository interface
type UserRepository interface {
	Create(user *User) error
	GetByID(id int) (*User, error)
	GetByEmail(email string) (*User, error)
	GetByAccountID(accountID int, limit, offset int) ([]User, int64, error)
	Update(user *User) error
	Delete(id int) error
	List(limit, offset int) ([]User, int64, error)
}

// AccountRepository interface
type AccountRepository interface {
	CreateAccount(account *Account) error
	GetAccountByID(accountID int) (*Account, error)
	GetAccountsByOwnerID(ownerID int) ([]Account, error)
	UpdateAccount(account *Account) error
	ListAllAccounts(limit, offset int) ([]Account, int64, error)
}

// PermissionRepository interface
type PermissionRepository interface {
	CreatePermission(perm *UserPermission) error
	GetPermissionsByUserID(userID, accountID int) ([]UserPermission, error)
	GetPermissionsByFarmID(farmID, accountID int) ([]UserPermission, error)
	RevokePermission(id int) error
	UpdatePermission(perm *UserPermission) error
	// Check if user has specific role in account or farm
	HasPermission(userID, accountID int, farmID *int, role string) (bool, error)
}

// InvitationRepository interface
type InvitationRepository interface {
	CreateInvitation(inv *UserInvitation) error
	GetInvitationByToken(token string) (*UserInvitation, error)
	GetPendingInvitationsByEmail(email string) ([]UserInvitation, error)
	AcceptInvitation(invitationID, userID int) error
	ListPendingInvitations(accountID int) ([]UserInvitation, error)
	DeleteExpiredInvitations() error
}

// AuditLogRepository interface
type AuditLogRepository interface {
	LogAction(log *AuditLog) error
	GetAuditLogs(accountID int, filters map[string]interface{}, limit, offset int) ([]AuditLog, int64, error)
	GetUserAuditLogs(userID, accountID int, limit, offset int) ([]AuditLog, int64, error)
}
