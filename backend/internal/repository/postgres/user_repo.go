package postgres

import (
	"database/sql"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type UserRepository struct {
	DB *sql.DB
}

func (r *UserRepository) Create(user *domain.User) error {
	query := `INSERT INTO users (username, email, password_hash, role, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`

	now := time.Now()
	err := r.DB.QueryRow(query, user.Username, user.Email, user.Password, user.Role, now, now).Scan(&user.ID)
	return err
}

func (r *UserRepository) GetByID(id int) (*domain.User, error) {
	query := `SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1`

	var user domain.User
	err := r.DB.QueryRow(query, id).Scan(
		&user.ID, &user.Username, &user.Email, &user.Password, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByEmail(email string) (*domain.User, error) {
	query := `SELECT id, username, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1`

	var user domain.User
	err := r.DB.QueryRow(query, email).Scan(
		&user.ID, &user.Username, &user.Email, &user.Password, &user.Role, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Update(user *domain.User) error {
	query := `UPDATE users SET username = $1, email = $2, password_hash = $3, role = $4, updated_at = $5 WHERE id = $6`
	_, err := r.DB.Exec(query, user.Username, user.Email, user.Password, user.Role, time.Now(), user.ID)
	return err
}

func (r *UserRepository) Delete(id int) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.DB.Exec(query, id)
	return err
}

func (r *UserRepository) List(limit, offset int) ([]domain.User, int64, error) {
	query := `SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY id LIMIT $1 OFFSET $2`
	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var user domain.User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}

	var total int64
	err = r.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}
