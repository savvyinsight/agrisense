package user

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	userRepo       UserRepository
	accountRepo    AccountRepository
	permissionRepo PermissionRepository
	jwtSecret      []byte
	tokenExpiry    time.Duration
}

type Claims struct {
	UserID    int   `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AccountID *int  `json:"account_id"`
	jwt.RegisteredClaims
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginResponse struct {
	Token       string           `json:"token"`
	User        User             `json:"user"`
	Account     *Account         `json:"account,omitempty"`
	Permissions []UserPermission `json:"permissions,omitempty"`
}

func NewService(userRepo UserRepository, accountRepo AccountRepository, permissionRepo PermissionRepository, jwtSecret string, tokenExpiry time.Duration) *Service {
	return &Service{
		userRepo:       userRepo,
		accountRepo:    accountRepo,
		permissionRepo: permissionRepo,
		jwtSecret:      []byte(jwtSecret),
		tokenExpiry:    tokenExpiry,
	}
}

func (s *Service) Register(req RegisterRequest) (*User, error) {
	// Check if user exists
	existing, _ := s.userRepo.GetByEmail(req.Email)
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Create user (initially without account_id = NULL)
	user := &User{
		Username:  req.Username,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Role:      "account_owner", // New user is account owner
		AccountID: nil,     // Will be set after account creation
	}

	err = s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	// Create account with this user as owner
	account := &Account{
		Name:              req.Username + "'s Farm",
		SubscriptionTier:  "basic",
		OwnerID:           user.ID,
		IsActive:          true,
	}

	err = s.accountRepo.CreateAccount(account)
	if err != nil {
		// If account creation fails, delete the user
		_ = s.userRepo.Delete(user.ID)
		return nil, err
	}

	// Update user with account_id
	user.AccountID = &account.ID
	err = s.userRepo.Update(user)
	if err != nil {
		return nil, err
	}

	// Create account_owner permission for this user
	ownerPerm := &UserPermission{
		UserID:    user.ID,
		AccountID: account.ID,
		FarmID:    nil, // applies to all farms
		Role:      RoleAccountOwner,
		GrantedBy: user.ID, // self-granted on registration
	}
	_ = s.permissionRepo.CreatePermission(ownerPerm) // non-fatal on failure

	// Don't return password hash
	user.Password = ""
	return user, nil
}

func (s *Service) Login(req LoginRequest) (*LoginResponse, error) {
	// Find user by email
	user, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	// Fetch account info
	var account *Account
	if user.AccountID != nil {
		acc, err := s.accountRepo.GetAccountByID(*user.AccountID)
		if err == nil {
			account = acc
		}
	}

	// Fetch permissions
	var permissions []UserPermission
	if user.AccountID != nil {
		perms, err := s.permissionRepo.GetPermissionsByUserID(user.ID, *user.AccountID)
		if err == nil {
			permissions = perms
		}
	}

	// Don't return password hash
	user.Password = ""

	return &LoginResponse{
		Token:       token,
		User:        *user,
		Account:     account,
		Permissions: permissions,
	}, nil
}

func (s *Service) generateToken(user *User) (string, error) {
	expirationTime := time.Now().Add(s.tokenExpiry)

	claims := &Claims{
		UserID:    user.ID,
		Email:     user.Email,
		Role:      user.Role,
		AccountID: user.AccountID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.Email,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
