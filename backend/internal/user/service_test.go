package user

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/crypto/bcrypt"
)

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

func TestRegister_Success(t *testing.T) {
	repo := new(mockUserRepo)
	service := NewService(repo, "secret-key", time.Hour)

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

	user, err := service.Register(req)

	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, 1, user.ID)
	assert.Equal(t, req.Username, user.Username)
	assert.Equal(t, req.Email, user.Email)
	assert.Empty(t, user.Password)

	repo.AssertExpectations(t)
}

func TestRegister_DuplicateEmail(t *testing.T) {
	repo := new(mockUserRepo)
	service := NewService(repo, "secret-key", time.Hour)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 5, Email: "tester@example.com"}, nil)

	user, err := service.Register(RegisterRequest{Username: "tester", Email: "tester@example.com", Password: "strong-password"})

	assert.Error(t, err)
	assert.Nil(t, user)
	assert.Contains(t, err.Error(), "email already registered")

	repo.AssertExpectations(t)
}

func TestLogin_Success(t *testing.T) {
	repo := new(mockUserRepo)
	service := NewService(repo, "secret-key", time.Hour)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("strong-password"), bcrypt.DefaultCost)
	assert.NoError(t, err)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 1, Email: "tester@example.com", Password: string(hashedPassword), Role: "viewer"}, nil)

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
	service := NewService(repo, "secret-key", time.Hour)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("strong-password"), bcrypt.DefaultCost)
	assert.NoError(t, err)

	repo.On("GetByEmail", "tester@example.com").Return(&User{ID: 1, Email: "tester@example.com", Password: string(hashedPassword), Role: "viewer"}, nil)

	resp, err := service.Login(LoginRequest{Email: "tester@example.com", Password: "wrong-password"})

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "invalid email or password")
}
