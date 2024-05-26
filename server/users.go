package main

import (
	"context"
	"database/sql"
	"encoding/hex"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/argon2"
)

type user struct {
	Id           int64  `db:"id"`
	ExternalId   string `db:"external_id"`
	PasswordHash string `db:"password_hash"`
}

var salt = []byte("chemoserotherapy-inbreather-glummy")

func getOrCreateUser(
	ctx context.Context,
	db *sqlx.Tx,
	password string,
) (user, error) {
	hash := hex.EncodeToString(argon2.IDKey([]byte(password), salt, 3, 64*1024, 2, 32))
	var u user
	if err := db.GetContext(ctx, &u, `
    SELECT
      id,
      external_id,
      password_hash
    FROM users
    WHERE password_hash = $1
  `, string(hash)); err != nil {
		if err != sql.ErrNoRows {
			return user{}, fmt.Errorf("getOrCreateUser: could not query user: %w", err)
		}
		// Create new user
		newExternalId, err := uuid.NewRandom()
		if err != nil {
			return user{}, fmt.Errorf("getOrCreateUser: could not create external id: %w", err)
		}
		var newUser user
		if err := db.GetContext(ctx, &newUser, `
      INSERT INTO users (external_id, password_hash)
      VALUES ($1, $2)
      RETURNING id, external_id, password_hash
    `, newExternalId, string(hash)); err != nil {
			return user{}, fmt.Errorf("getOrCreateUser: could not insert user: %w", err)
		}
		return newUser, nil
	} else {
		return u, nil
	}
}
