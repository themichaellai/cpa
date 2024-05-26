package db

import (
	"context"
	"fmt"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	. "github.com/themichaellai/cpa/gen/table"
)

func SetSpaceVersion(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	version int64,
) error {
	res, err := Spaces.UPDATE(Spaces.Version).
		SET(sqlite.Int64(version)).
		WHERE(Spaces.ID.EQ(sqlite.Int64(spaceId))).
		ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not update space version: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("could not get rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("SetSpaceVersion: expected 1 row to be affected, got %d", rowsAffected)
	}

	return nil
}
