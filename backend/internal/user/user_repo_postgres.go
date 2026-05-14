package user

import (
	"database/sql"
	"time"
)

type PostgresUserRepository struct {
	DB *sql.DB
}

func (r *PostgresUserRepository) Create(user *User) error {
	query := `INSERT INTO users (username, email, password_hash, role, account_id, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`

	now := time.Now()
	err := r.DB.QueryRow(query, user.Username, user.Email, user.Password, user.Role, user.AccountID, now, now).Scan(&user.ID)
	return err
}

func (r *PostgresUserRepository) GetByID(id int) (*User, error) {
	query := `SELECT id, username, email, password_hash, role, account_id, created_at, updated_at FROM users WHERE id = $1`

	var user User
	err := r.DB.QueryRow(query, id).Scan(
		&user.ID, &user.Username, &user.Email, &user.Password, &user.Role, &user.AccountID, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) GetByEmail(email string) (*User, error) {
	query := `SELECT id, username, email, password_hash, role, account_id, created_at, updated_at FROM users WHERE email = $1`

	var user User
	err := r.DB.QueryRow(query, email).Scan(
		&user.ID, &user.Username, &user.Email, &user.Password, &user.Role, &user.AccountID, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *PostgresUserRepository) Update(user *User) error {
	query := `UPDATE users SET username = $1, email = $2, password_hash = $3, role = $4, account_id = $5, updated_at = $6 WHERE id = $7`
	_, err := r.DB.Exec(query, user.Username, user.Email, user.Password, user.Role, user.AccountID, time.Now(), user.ID)
	return err
}

func (r *PostgresUserRepository) Delete(id int) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.DB.Exec(query, id)
	return err
}

func (r *PostgresUserRepository) List(limit, offset int) ([]User, int64, error) {
	query := `SELECT id, username, email, role, account_id, created_at, updated_at FROM users ORDER BY id LIMIT $1 OFFSET $2`
	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var users []User
	for rows.Next() {
		var user User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.AccountID, &user.CreatedAt, &user.UpdatedAt)
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

func (r *PostgresUserRepository) GetByAccountID(accountID int, limit, offset int) ([]User, int64, error) {
	query := `SELECT id, username, email, role, account_id, created_at, updated_at FROM users WHERE account_id = $1 ORDER BY id LIMIT $2 OFFSET $3`
	rows, err := r.DB.Query(query, accountID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var users []User
	for rows.Next() {
		var user User
		err := rows.Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.AccountID, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		users = append(users, user)
	}

	var total int64
	err = r.DB.QueryRow(`SELECT COUNT(*) FROM users WHERE account_id = $1`, accountID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}
