package domain

import (
	"time"
)

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // "-" excludes from JSON
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UserRepository interface {
	Create(user *User) error
	GetByID(id int) (*User, error)
	GetByEmail(email string) (*User, error)
	Update(user *User) error
	Delete(id int) error
	List(limit, offset int) ([]User, int64, error)
}
