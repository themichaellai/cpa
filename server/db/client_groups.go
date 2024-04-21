package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	. "github.com/themichaellai/cpa/gen/table"
)

func ReplicacheClientGroupGetOrCreate(
	ctx context.Context,
	tx *sqlx.Tx,
	clientGroupExternalId string,
	spaceId int64,
	userId int64,
) (clientGroupId int64, _ error) {
	errPrefix := "ReplicacheClientGroupGetOrCreate:"
	var existingClientGroupId int64
	existingClientGroupQuery, existingClientGroupArgs := sqlite.
		SELECT(ReplicacheClientGroups.ID).
		FROM(ReplicacheClientGroups).
		WHERE(
			ReplicacheClientGroups.ExternalID.
				EQ(sqlite.String(clientGroupExternalId)),
		).Sql()
	if err := tx.GetContext(ctx, &existingClientGroupId, existingClientGroupQuery, existingClientGroupArgs...); err != nil {
		if err != sql.ErrNoRows {
			return 0, fmt.Errorf("%s could not query: %w", errPrefix, err)
		}
		newClientGroupQuery, newClientGroupArgs := ReplicacheClientGroups.INSERT(
			ReplicacheClientGroups.ExternalID,
			ReplicacheClientGroups.SpaceID,
			ReplicacheClientGroups.UserID,
		).VALUES(
			sqlite.String(clientGroupExternalId),
			sqlite.Int64(spaceId),
			sqlite.Int64(userId),
		).RETURNING(ReplicacheClientGroups.ID).Sql()
		var newClientGroupId int64
		if err := tx.GetContext(ctx, &newClientGroupId, newClientGroupQuery, newClientGroupArgs...); err != nil {
			return 0, fmt.Errorf("%s could not insert: %w", errPrefix, err)
		}
		return newClientGroupId, nil
	}
	return existingClientGroupId, nil
}
