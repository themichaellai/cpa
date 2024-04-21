package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	. "github.com/themichaellai/cpa/gen/table"
)

type ReplicacheClientRow struct {
	ExternalId            string `db:"external_id"`
	ClientGroupExternalId string `db:"client_group_external_id"`
	LastMutationId        int64  `db:"last_mutation_id"`
	LastModifiedVersion   int64  `db:"last_modified_version"`
}

func ReplicacheClientGet(
	ctx context.Context,
	tx *sqlx.Tx,
	clientExternalId string,
) (_ ReplicacheClientRow, ok bool, _ error) {
	var row ReplicacheClientRow
	query, args := sqlite.SELECT(
		ReplicacheClients.ExternalID.AS("external_id"),
		ReplicacheClients.LastMutationID.AS("last_mutation_id"),
		ReplicacheClients.LastModifiedVersion.AS("last_modified_version"),
		ReplicacheClientGroups.ExternalID.AS("client_group_external_id"),
	).
		FROM(ReplicacheClients.
			INNER_JOIN(
				ReplicacheClientGroups,
				ReplicacheClients.ReplicacheClientGroupID.
					EQ(ReplicacheClientGroups.ID)),
		).
		WHERE(ReplicacheClients.ExternalID.EQ(sqlite.String(clientExternalId))).
		Sql()
	if err := tx.GetContext(ctx, &row, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return ReplicacheClientRow{}, false, nil
		}
		return ReplicacheClientRow{}, false, fmt.Errorf("could not query replicache client: %w", err)
	}
	return row, true, nil
}

func ReplicacheClientSet(
	ctx context.Context,
	tx *sqlx.Tx,
	clientExternalId string,
	clientGroupId int32,
	lastMutationId int64,
	lastModifiedVersion int64,
) error {
	_, hasClient, err := ReplicacheClientGet(ctx, tx, clientExternalId)
	if err != nil {
		return fmt.Errorf("RepliacheClientSet: %w", err)
	}
	if !hasClient {
		if _, err := ReplicacheClients.INSERT(
			ReplicacheClients.ExternalID,
			ReplicacheClients.LastMutationID,
			ReplicacheClients.LastModifiedVersion,
			ReplicacheClients.ReplicacheClientGroupID,
		).VALUES(
			sqlite.String(clientExternalId),
			sqlite.Int64(lastMutationId),
			sqlite.Int64(lastModifiedVersion),
			sqlite.Int32(clientGroupId),
		).ExecContext(ctx, tx); err != nil {
			return fmt.Errorf("ReplicacheClientSet: could not insert replicache client: %w", err)
		}
		return nil
	}
	updateRes, err := ReplicacheClients.UPDATE(
		ReplicacheClients.LastMutationID,
		ReplicacheClients.LastModifiedVersion,
	).SET(
		sqlite.Int64(lastMutationId),
		sqlite.Int64(lastModifiedVersion),
	).WHERE(
		ReplicacheClients.ExternalID.EQ(sqlite.String(clientExternalId)),
	).ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("ReplicacheClientSet: could not update replicache client: %w", err)
	}
	rowsAffected, err := updateRes.RowsAffected()
	if err != nil {
		return fmt.Errorf("ReplicacheClientSet: could not get rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("ReplicacheClientSet: expected 1 row to be affected, got %d", rowsAffected)
	}
	return nil
}
