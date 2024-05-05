package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	. "github.com/themichaellai/cpa/gen/table"
)

type DinnerSize string

const (
	DinnerSizeRegular DinnerSize = "regular"
	DinnerSizeBig     DinnerSize = "big"
)

func ParseToDinnerSize(s string) (DinnerSize, bool) {
	switch s {
	case "regular":
		return DinnerSizeRegular, true
	case "big":
		return DinnerSizeBig, true
	default:
		return "", false
	}
}

func (d *DinnerSize) ToSql() interface{} {
	if d == nil {
		return sqlite.NULL
	}
	return sqlite.String(string(*d))
}

func getOrCreateDay(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	date ParsedDate,
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
			Days.Date.EQ(sqlite.String(string(date))).
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
			sqlite.String(string(date)),
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

func timeToSqliteTime(t *time.Time) interface{} {
	if t == nil {
		return sqlite.NULL
	}

	return sqlite.DateTime(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), time.Duration(t.Nanosecond()))
}

func SetDay(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	lastModifiedVersion int64,
	date ParsedDate,
	dayExternalId string,
	wakeUpTime *time.Time,
	wakeUpTimeTz *time.Location,
	dinnerSize *DinnerSize,
) error {
	dayId, err := getOrCreateDay(ctx, tx, spaceId, date, dayExternalId)
	if err != nil {
		return fmt.Errorf("SetWakeUpTime: %w", err)
	}
	res, err := Days.UPDATE(
		Days.WakeUpTime,
		Days.WakeUpTimeTz,
		Days.LastModifiedVersion,
		Days.DinnerSize,
	).
		SET(
			timeToSqliteTime(wakeUpTime),
			sqlite.String(wakeUpTimeTz.String()),
			sqlite.Int64(lastModifiedVersion),
			dinnerSize.ToSql(),
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

func AddPoop(
	ctx context.Context,
	log *logrus.Logger,
	tx *sqlx.Tx,
	spaceId int64,
	dayNewVersion int64,
	dayExternalId string,
	date ParsedDate,
	time time.Time,
	timeTz *time.Location,
) error {
	dayId, err := getOrCreateDay(ctx, tx, spaceId, date, dayExternalId)
	if err != nil {
		return err
	}
	newPoopQuery, newPoopArgs := Poops.INSERT(
		Poops.ExternalID,
		Poops.DayID,
		Poops.Time,
		Poops.TimeTz,
	).VALUES(
		sqlite.String(uuid.New().String()),
		sqlite.Int32(dayId),
		timeToSqliteTime(&time),
		sqlite.String(timeTz.String()),
	).RETURNING(Poops.ID).Sql()
	var newPoopId int32
	if err := tx.GetContext(ctx, &newPoopId, newPoopQuery, newPoopArgs...); err != nil {
		return fmt.Errorf("could not insert poop: %w", err)
	}

	// Update version on the day
	res, err := Days.UPDATE(
		Days.LastModifiedVersion,
	).SET(
		sqlite.Int64(dayNewVersion),
	).WHERE(
		Days.ID.EQ(sqlite.Int32(dayId)),
	).ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not update day version: %w", err)
	}
	rowsChanged, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("could not check rows changed: %w", err)
	}
	if rowsChanged == 0 {
		err := fmt.Errorf("no rows changed when updating day")
		log.WithFields(logrus.Fields{
			"dayId":         dayId,
			"dayNewVersion": dayNewVersion,
		}).Error(err.Error())
		return err
	}

	return nil
}
