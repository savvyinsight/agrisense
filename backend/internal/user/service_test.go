package user

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/crypto/bcrypt"
)

func intPtr(i int) *int { return &i }

type mockUserRepo struct {
	mock.Mock
}

func (m *mockUserRepo) Create(user *User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *mockUserRepo) GetByID(id int) (*User, error) {
	args := m.Called(id)
	if user, ok := args.Get(0).(*User); ok {
		return user, args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockUserRepo) GetByEmail(email string) (*User, error) {
	args := m.Called(email)
	if user, ok := args.Get(0).(*User); ok {
		return user, args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *mockUserRepo) Update(user *User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *mockUserRepo) Delete(id int) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *mockUserRepo) List(limit, offset int) ([]User, int64, error) {
	args := m.Called(limit, offset)
	users, _ := args.Get(0).([]User)
	return users, args.Get(1).(int64), args.Error(2)
}
func (m *mockUserRepo) GetByAccountID(accountID int, limit, offset int) ([]User, int64, error) {
	args := m.Called(accountID, limit, offset)
	users, _ := args.Get(0).([]User)
	return users, args.Get(1).(int64), args.Error(2)
}

// Mock AccountRepository
type mockAccountRepo struct{ mock.Mock }

func (m *mockAccountRepo) CreateAccount(account *Account) error {
	args := m.Called(account)
	return args.Error(0)
}
func (m *mockAccountRepo) GetAccountByID(accountID int) (*Account, error) {
	args := m.Called(accountID)
	if a, ok := args.Get(0).(*Account); ok {
		return a, args.Error(1)
	}
	return nil, args.Error(1)
}
func (m *mockAccountRepo) GetAccountsByOwnerID(ownerID int) ([]Account, error) {
	args := m.Called(ownerID)
	accounts, _ := args.Get(0).([]Account)
	return accounts, args.Error(1)
}
func (m *mockAccountRepo) UpdateAccount(account *Account) error {
	args := m.Called(account)
	return args.Error(0)
}
type mockInvitationRepo struct{ mock.Mock }

func (m *mockInvitationRepo) CreateInvitation(inv *UserInvitation) error {
	args := m.Called(inv)
	return args.Error(0)
}
func (m *mockInvitationRepo) GetInvitationByToken(token string) (*UserInvitation, error) {
	args := m.Called(token)
	if inv, ok := args.Get(0).(*UserInvitation); ok {
		return inv, args.Error(1)
	}
	return nil, args.Error(1)
}
func (m *mockInvitationRepo) GetPendingInvitationsByEmail(email string) ([]UserInvitation, error) {
	args := m.Called(email)
	inv, _ := args.Get(0).([]UserInvitation)
	return inv, args.Error(1)
}
func (m *mockInvitationRepo) AcceptInvitation(invitationID, userID int) error {
	args := m.Called(invitationID, userID)
	return args.Error(0)
}
func (m *mockInvitationRepo) ListPendingInvitations(accountID int) ([]UserInvitation, error) {
	args := m.Called(accountID)
	inv, _ := args.Get(0).([]UserInvitation)
	return inv, args.Error(1)
}
func (m *mockInvitationRepo) DeleteExpiredInvitations() error {
	args := m.Called()
	return args.Error(0)
}

func (m *mockAccountRepo) ListAllAccounts(limit, offset int) ([]Account, int64, error) {
	args := m.Called(limit, offset)
	accounts, _ := args.Get(0).([]Account)
	return accounts, args.Get(1).(int64), args.Error(2)
}
func (m *mockAccountRepo) GetUserCountByAccount(accountID int) (int64, error) {
	args := m.Called(accountID)
	return args.Get(0).(int64), args.Error(1)
}
func (m *mockAccountRepo) GetDeviceCountByAccount(accountID int) (int64, error) {
	args := m.Called(accountID)
	return args.Get(0).(int64), args.Error(1)
}
func (m *mockAccountRepo) CheckUserQuota(accountID int) error {
	args := m.Called(accountID)
	return args.Error(0)
}
func (m *mockAccountRepo) CheckDeviceQuota(accountID int) error {
	args := m.Called(accountID)
	return args.Error(0)
}

// Mock PermissionRepository
type mockPermissionRepo struct{ mock.Mock }

func (m *mockPermissionRepo) CreatePermission(perm *UserPermission) error {
	args := m.Called(perm)
	return args.Error(0)
}
func (m *mockPermissionRepo) GetPermissionsByUserID(userID, accountID int) ([]UserPermission, error) {
	args := m.Called(userID, accountID)
	perms, _ := args.Get(0).([]UserPermission)
	return perms, args.Error(1)
}
func (m *mockPermissionRepo) GetPermissionsByFarmID(farmID, accountID int) ([]UserPermission, error) {
	args := m.Called(farmID, accountID)
	perms, _ := args.Get(0).([]UserPermission)
	return perms, args.Error(1)
}
func (m *mockPermissionRepo) RevokePermission(id int) error {
	args := m.Called(id)
	return args.Error(0)
}
func (m *mockPermissionRepo) UpdatePermission(perm *UserPermission) error {
	args := m.Called(perm)
	return args.Error(0)
}
func (m *mockPermissionRepo) HasPermission(userID, accountID int, farmID *int, role string) (bool, error) {
	args := m.Called(userID, accountID, farmID, role)
	return args.Bool(0), args.Error(1)
}

func TestRegister_Success(t *testing.T) {
	repo := new(mockUserRepo)
	accountRepo := new(mockAccountRepo)
	permRepo := new(mockPermissionRepo)
	invRepo := new(mockInvitationRepo)
	service := NewService(repo, accountRepo, permRepo, invRepo, "secret-key", time.Hour)

	req := RegisterRequest{
		Username: "tester",
		Email:    "tester@example.com",
		Password: "strong-password",
	}

	repo.On("GetByEmail", req.Email).Return((*User)(nil), nil)
	repo.On("Create", mock.AnythingOfType("*user.User")).Return(nil).Run(func(args mock.Arguments) {
		userArg := args.Get(0).(*User)
		userArg.ID = 1
	})
	accountRepo.On("CreateAccount", mock.AnythingOfType("*user.Account")).Return(nil).Run(func(args mock.Arguments) {
		accArg := args.Get(0).(*Account)
		accArg.ID = 10
	})
	repo.On("Update", mock.AnythingOfType("*user.User")).Return(nil)
	permRepo.On("CreatePermission", mock.AnythingOfType("*user.UserPermission")).Return(nil)

	user, err := service.Register(req)

	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, 1, user.ID)
	assert.Equal(t, req.Username, user.Username)
	assert.Equal(t, req.Email, user.Email)
	assert.Empty(t, user.Password)

	repo.AssertExpectations(t)
	accountRepo.AssertExpectations(t)
	permRepo.AssertExpectations(t)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	repo := new(mockUserRepo)
	accountRepo := new(mockAccountRepo)
	permRepo := new(mockPermissionRepo)
	invRepo := new(mockInvitationRepo)
	service := NewService(repo, accountRepo, permRepo, invRepo, "secret-key", time.Hour)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 5, Email: "tester@example.com"}, nil)

	user, err := service.Register(RegisterRequest{Username: "tester", Email: "tester@example.com", Password: "strong-password"})

	assert.Error(t, err)
	assert.Nil(t, user)
	assert.Contains(t, err.Error(), "email already registered")

	repo.AssertExpectations(t)
}

func TestLogin_Success(t *testing.T) {
	repo := new(mockUserRepo)
	accountRepo := new(mockAccountRepo)
	permRepo := new(mockPermissionRepo)
	invRepo := new(mockInvitationRepo)
	service := NewService(repo, accountRepo, permRepo, invRepo, "secret-key", time.Hour)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("strong-password"), bcrypt.DefaultCost)
	assert.NoError(t, err)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 1, Email: "tester@example.com", Password: string(hashedPassword), Role: "viewer", AccountID: intPtr(1)}, nil)
	accountRepo.On("GetAccountByID", 1).Return(&Account{ID: 1, Name: "Test Farm"}, nil)
	permRepo.On("GetPermissionsByUserID", 1, 1).Return([]UserPermission{}, nil)

	resp, err := service.Login(LoginRequest{Email: "tester@example.com", Password: "strong-password"})

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "tester@example.com", resp.User.Email)
	assert.Empty(t, resp.User.Password)

	claims, err := service.ValidateToken(resp.Token)
	assert.NoError(t, err)
	assert.Equal(t, 1, claims.UserID)
	assert.Equal(t, "tester@example.com", claims.Email)
}

func TestLogin_InvalidPassword(t *testing.T) {
	repo := new(mockUserRepo)
	accountRepo := new(mockAccountRepo)
	permRepo := new(mockPermissionRepo)
	invRepo := new(mockInvitationRepo)
	service := NewService(repo, accountRepo, permRepo, invRepo, "secret-key", time.Hour)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("strong-password"), bcrypt.DefaultCost)
	assert.NoError(t, err)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 1, Email: "tester@example.com", Password: string(hashedPassword), Role: "viewer"}, nil)

	resp, err := service.Login(LoginRequest{Email: "tester@example.com", Password: "wrong-password"})

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "invalid email or password")
}
