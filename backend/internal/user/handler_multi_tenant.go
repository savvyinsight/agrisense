package user

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"agrisense/internal/middleware"
)

// UserHandler handles user and account management endpoints
type UserHandler struct {
	UserRepo       UserRepository
	AccountRepo    AccountRepository
	PermissionRepo PermissionRepository
	InvitationRepo InvitationRepository
	AuditRepo      AuditLogRepository
}

// Request/Response DTOs
type CreateAccountRequest struct {
	Name             string `json:"name"`
	SubscriptionTier string `json:"subscription_tier"`
}

type InviteUserRequest struct {
	Email  string `json:"email"`
	Role   string `json:"role"`
	FarmID *int   `json:"farm_id"`
}

type UpdatePermissionRequest struct {
	Role string `json:"role"`
}

type GetTeamResponse struct {
	Users       []UserWithPermissions `json:"users"`
	Invitations []UserInvitation      `json:"invitations"`
}

type UserWithPermissions struct {
	ID          int                 `json:"id"`
	Email       string              `json:"email"`
	Username    string              `json:"username"`
	Permissions []UserPermission    `json:"permissions"`
	CreatedAt   time.Time           `json:"created_at"`
}

// CreateAccountHandler creates a new account (subscription customer)
// POST /api/v1/accounts
func (h *UserHandler) CreateAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	usr, err := middleware.GetUserFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Only admins can create new accounts
	if usr.Role != "admin" {
		http.Error(w, "Forbidden: Only admins can create accounts", http.StatusForbidden)
		return
	}

	var req CreateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	account := &Account{
		Name:             req.Name,
		SubscriptionTier: req.SubscriptionTier,
		OwnerID:          usr.ID,
		IsActive:         true,
	}

	if err := h.AccountRepo.CreateAccount(account); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create account: %v", err), http.StatusInternalServerError)
		return
	}

	// Log action
	h.LogAuditAction(&AuditLog{
		AccountID:    account.ID,
		UserID:       &usr.ID,
		Action:       "create",
		ResourceType: "account",
		ResourceID:   fmt.Sprintf("%d", account.ID),
		ResourceName: account.Name,
		Status:       "success",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(account)
}

// GetAccountHandler retrieves account details
// GET /api/v1/accounts/:id
func (h *UserHandler) GetAccountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	account, err := h.AccountRepo.GetAccountByID(accountID)
	if err != nil {
		http.Error(w, "Account not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(account)
}

// InviteUserHandler invites a new user to the account
// POST /api/v1/accounts/:id/users/invite
func (h *UserHandler) InviteUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	usr, err := middleware.GetUserFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	// Check permission: only account_owner or farm_manager can invite
	hasPermission, err := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if err == nil && !hasPermission {
		hasPermission, _ = h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleFarmManager)
	}
	if err != nil || !hasPermission {
		http.Error(w, "Forbidden: Only account owners and managers can invite users", http.StatusForbidden)
		return
	}

	var req InviteUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate invitation token
	token := generateInvitationToken()

	invitation := &UserInvitation{
		AccountID:       accountID,
		Email:           req.Email,
		Role:            req.Role,
		FarmID:          req.FarmID,
		InvitationToken: token,
		InvitedByID:     usr.ID,
		ExpiresAt:       time.Now().Add(7 * 24 * time.Hour), // 7-day expiration
	}

	if err := h.InvitationRepo.CreateInvitation(invitation); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create invitation: %v", err), http.StatusInternalServerError)
		return
	}

	// Log action
	h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "create",
		ResourceType: "user_invitation",
		ResourceID:   fmt.Sprintf("%d", invitation.ID),
		ResourceName: invitation.Email,
		Status:       "success",
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invitation)
}

// ListTeamHandler lists all users in an account
// GET /api/v1/accounts/:id/users
func (h *UserHandler) ListTeamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	// Get all users in account (limit/offset from query params)
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	users, _, err := h.UserRepo.GetByAccountID(accountID, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list users: %v", err), http.StatusInternalServerError)
		return
	}

	// Enrich users with permissions
	var enrichedUsers []UserWithPermissions
	for _, u := range users {
		perms, err := h.PermissionRepo.GetPermissionsByUserID(u.ID, accountID)
		if err != nil {
			perms = []UserPermission{}
		}

		enrichedUsers = append(enrichedUsers, UserWithPermissions{
			ID:          u.ID,
			Email:       u.Email,
			Username:    u.Username,
			Permissions: perms,
			CreatedAt:   u.CreatedAt,
		})
	}

	// Get pending invitations
	invitations, err := h.InvitationRepo.ListPendingInvitations(accountID)
	if err != nil {
		invitations = []UserInvitation{}
	}

	response := GetTeamResponse{
		Users:       enrichedUsers,
		Invitations: invitations,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateUserPermissionHandler updates a user's role
// PUT /api/v1/accounts/:id/users/:uid/permission/:pid
func (h *UserHandler) UpdateUserPermissionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	usr, err := middleware.GetUserFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	// Check permission: only account_owner can update permissions
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		http.Error(w, "Forbidden: Only account owners can update permissions", http.StatusForbidden)
		return
	}

	// Extract permission ID from path
	permIDStr := r.URL.Query().Get("permission_id")
	if permIDStr == "" {
		http.Error(w, "Permission ID required", http.StatusBadRequest)
		return
	}

	permID, err := strconv.Atoi(permIDStr)
	if err != nil {
		http.Error(w, "Invalid permission ID", http.StatusBadRequest)
		return
	}

	var req UpdatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get existing permission for logging
	perms, _ := h.PermissionRepo.GetPermissionsByUserID(usr.ID, accountID)
	var oldRole string
	for _, p := range perms {
		if p.ID == permID {
			oldRole = p.Role
			break
		}
	}

	perm := &UserPermission{
		ID:   permID,
		Role: req.Role,
	}

	if err := h.PermissionRepo.UpdatePermission(perm); err != nil {
		http.Error(w, fmt.Sprintf("Failed to update permission: %v", err), http.StatusInternalServerError)
		return
	}

	// Log action
	h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "update",
		ResourceType: "user_permission",
		ResourceID:   fmt.Sprintf("%d", permID),
		OldValues:    map[string]interface{}{"role": oldRole},
		NewValues:    map[string]interface{}{"role": req.Role},
		Status:       "success",
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(perm)
}

// RevokeUserHandler revokes user access from account
// DELETE /api/v1/accounts/:id/users/:uid
func (h *UserHandler) RevokeUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	usr, err := middleware.GetUserFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	// Check permission: only account_owner can revoke
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		http.Error(w, "Forbidden: Only account owners can revoke access", http.StatusForbidden)
		return
	}

	permIDStr := r.URL.Query().Get("permission_id")
	if permIDStr == "" {
		http.Error(w, "Permission ID required", http.StatusBadRequest)
		return
	}

	permID, err := strconv.Atoi(permIDStr)
	if err != nil {
		http.Error(w, "Invalid permission ID", http.StatusBadRequest)
		return
	}

	if err := h.PermissionRepo.RevokePermission(permID); err != nil {
		http.Error(w, fmt.Sprintf("Failed to revoke permission: %v", err), http.StatusInternalServerError)
		return
	}

	// Log action
	h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "delete",
		ResourceType: "user_permission",
		ResourceID:   fmt.Sprintf("%d", permID),
		Status:       "success",
	})

	w.WriteHeader(http.StatusNoContent)
}

// GetAuditLogHandler retrieves audit logs for account
// GET /api/v1/accounts/:id/audit?resource_type=user&action=create
func (h *UserHandler) GetAuditLogHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	usr, err := middleware.GetUserFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	accountID, err := middleware.GetAccountIDFromContext(r)
	if err != nil {
		http.Error(w, "Account ID not found", http.StatusBadRequest)
		return
	}

	// Check permission: only account_owner can view audit logs
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		http.Error(w, "Forbidden: Only account owners can view audit logs", http.StatusForbidden)
		return
	}

	// Parse pagination
	limit := 50
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Parse filters
	filters := map[string]interface{}{}
	if resourceType := r.URL.Query().Get("resource_type"); resourceType != "" {
		filters["resource_type"] = resourceType
	}
	if action := r.URL.Query().Get("action"); action != "" {
		filters["action"] = action
	}

	logs, total, err := h.AuditRepo.GetAuditLogs(accountID, filters, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to retrieve audit logs: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"logs":  logs,
		"total": total,
		"limit": limit,
		"offset": offset,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper functions

// generateInvitationToken creates a secure random token for invitations
func generateInvitationToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// LogAuditAction logs an action to the audit log
func (h *UserHandler) LogAuditAction(log *AuditLog) error {
	if log.AccountID == 0 || h.AuditRepo == nil {
		return fmt.Errorf("missing account_id or audit repo")
	}

	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}

	return h.AuditRepo.LogAction(log)
}
