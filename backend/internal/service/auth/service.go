package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	userRepo    domain.UserRepository
	jwtSecret   []byte
	tokenExpiry time.Duration
}

type Claims struct {
	UserID int    `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
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
	Token string      `json:"token"`
	User  domain.User `json:"user"`
}

func NewService(userRepo domain.UserRepository, jwtSecret string, tokenExpiry time.Duration) *Service {
	return &Service{
		userRepo:    userRepo,
		jwtSecret:   []byte(jwtSecret),
		tokenExpiry: tokenExpiry,
	}
}

func (s *Service) Register(req RegisterRequest) (*domain.User, error) {
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

	// Create user
	user := &domain.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     "viewer", // Default role
	}

	err = s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

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

	// Don't return password hash
	user.Password = ""

	return &LoginResponse{
		Token: token,
		User:  *user,
	}, nil
}

func (s *Service) generateToken(user *domain.User) (string, error) {
	expirationTime := time.Now().Add(s.tokenExpiry)

	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
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
