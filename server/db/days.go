package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	. "github.com/themichaellai/cpa/gen/table"
)

func getOrCreateDay(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	date string,
	dayExternalId string,
) (dayId int32, _ error) {
	type dayIdResult struct {
		ID int32
	}
	var existingDayId dayIdResult
	existingDayQuery, existingDayArgs := sqlite.
		SELECT(Days.ID.AS("id")).
		FROM(Days).
		WHERE(
			Days.Date.EQ(sqlite.String(date)).
				AND(Days.ExternalID.EQ(sqlite.String(dayExternalId))).
				AND(Days.SpaceID.EQ(sqlite.Int64(spaceId))),
		).Sql()

	if err := tx.GetContext(ctx, &existingDayId, existingDayQuery, existingDayArgs...); err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("could not query day: %w", err)
		}
		newDayQuery, newDayArgs := Days.INSERT(
			Days.ExternalID,
			Days.Date,
			Days.SpaceID,
			Days.LastModifiedVersion,
		).VALUES(
			sqlite.String(dayExternalId),
			sqlite.String(date),
			sqlite.Int64(spaceId),
			sqlite.Int64(0),
		).RETURNING(Days.ID.AS("id")).Sql()
		var newDayId dayIdResult
		if err := tx.GetContext(ctx, &newDayId, newDayQuery, newDayArgs...); err != nil {
			return 0, fmt.Errorf("could not insert day: %w", err)
		}
		return newDayId.ID, nil
	}
	return existingDayId.ID, nil
}

func timeToSqliteTime(t time.Time) sqlite.DateTimeExpression {
	return sqlite.DateTime(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), time.Duration(t.Nanosecond()))
}

func SetWakeUpTime(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	lastModifiedVersion int64,
	date string,
	dayExternalId string,
	wakeUpTime time.Time,
	wakeUpTimeTz *time.Location,
) error {
	dayId, err := getOrCreateDay(ctx, tx, spaceId, date, dayExternalId)
	if err != nil {
		return fmt.Errorf("SetWakeUpTime: %w", err)
	}
	res, err := Days.UPDATE(
		Days.WakeUpTime,
		Days.WakeUpTimeTz,
		Days.LastModifiedVersion,
	).
		SET(
			timeToSqliteTime(wakeUpTime),
			sqlite.String(wakeUpTimeTz.String()),
			sqlite.Int64(lastModifiedVersion),
		).
		WHERE(Days.ID.EQ(sqlite.Int32(dayId))).
		ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not update wake up time: %w", err)
	}
	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("could not check rows changed: %w", err)
	}
	if rowsChanged == 0 {
		return fmt.Errorf("no rows changed")
	}
	return nil
}
