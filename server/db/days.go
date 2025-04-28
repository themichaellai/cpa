package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-jet/jet/v2/sqlite"
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

func stringToSqliteString(s *string) interface{} {
	if s == nil {
		return sqlite.NULL
	}
	return sqlite.String(*s)
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
	comment *string,
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
		Days.Comment,
	).
		SET(
			timeToSqliteTime(wakeUpTime),
			sqlite.String(wakeUpTimeTz.String()),
			sqlite.Int64(lastModifiedVersion),
			dinnerSize.ToSql(),
			stringToSqliteString(comment),
		).
		WHERE(Days.ID.EQ(sqlite.Int32(dayId))).
		ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not update day: %w", err)
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
	poopExternalId string,
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
		sqlite.String(poopExternalId),
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

func updateDayVersion(
	ctx context.Context,
	log *logrus.Logger,
	tx *sqlx.Tx,
	dayId int64,
	dayNewVersion int64,
) error {
	res, err := Days.UPDATE(
		Days.LastModifiedVersion,
	).SET(
		sqlite.Int64(dayNewVersion),
	).WHERE(
		Days.ID.EQ(sqlite.Int32(int32(dayId))),
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

func SetPoop(
	ctx context.Context,
	log *logrus.Logger,
	tx *sqlx.Tx,
	spaceId int64,
	dayNewVersion int64,
	dayExternalId string,
	date ParsedDate,
	poopExternalId string,
	time time.Time,
	timeTz *time.Location,
	onRun bool,
) error {
	dayId, err := getOrCreateDay(ctx, tx, spaceId, date, dayExternalId)
	if err != nil {
		return err
	}
	timeIntoRunMins := sqlite.NULL
	if onRun {
		timeIntoRunMins = sqlite.Int64(0)
	}
	updatedPoopRes, err := Poops.UPDATE(
		Poops.Time,
		Poops.TimeTz,
		Poops.TimeIntoRunMinutes,
	).SET(
		timeToSqliteTime(&time),
		sqlite.String(timeTz.String()),
		timeIntoRunMins,
	).WHERE(
		Poops.ExternalID.EQ(sqlite.String(poopExternalId)).AND(
			Poops.DayID.EQ(sqlite.Int32(dayId)),
		)).ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not update poop: %w", err)
	}
	poopRowsChanged, err := updatedPoopRes.RowsAffected()
	if err != nil {
		return fmt.Errorf("could not check rows changed: %w", err)
	}
	if poopRowsChanged == 0 {
		log.WithFields(logrus.Fields{
			"day_id":           dayId,
			"poop_external_id": poopExternalId,
		}).Warn("no rows changed when updating poop")
	}

	if err := updateDayVersion(ctx, log, tx, int64(dayId), dayNewVersion); err != nil {
		return err
	}
	return nil
}

func RemovePoop(
	ctx context.Context,
	log *logrus.Logger,
	tx *sqlx.Tx,
	spaceId int64,
	dayNewVersion int64,
	dayExternalId string,
	poopExternalId string,
) error {
	existingDayQuery, existingDayArgs := sqlite.SELECT(Days.ID.AS("id")).
		FROM(Days).
		WHERE(
			Days.ExternalID.EQ(sqlite.String(dayExternalId)).
				AND(Days.SpaceID.EQ(sqlite.Int64(spaceId))),
		).Sql()
	var existingDayId int64
	if err := tx.GetContext(ctx, &existingDayId, existingDayQuery, existingDayArgs...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Day doesn't exist -- ignore
			return nil
		}
		return fmt.Errorf("could not query day: %w", err)
	}
	deletedAt := time.Now()
	deleteRes, err := Poops.UPDATE(
		Poops.DeletedAt,
	).SET(timeToSqliteTime(&deletedAt)).
		WHERE(
			Poops.ExternalID.EQ(sqlite.String(poopExternalId)).AND(
				Poops.DayID.EQ(sqlite.Int64(existingDayId)),
			),
		).ExecContext(ctx, tx)
	if err != nil {
		return fmt.Errorf("could not delete poop: %w", err)
	}
	rowsChanged, err := deleteRes.RowsAffected()
	if err != nil {
		return fmt.Errorf("could not check rows changed: %w", err)
	}
	if rowsChanged == 0 {
		log.WithFields(logrus.Fields{
			"day_id":           existingDayId,
			"poop_external_id": poopExternalId,
		}).Warn("no rows changed when deleting poop")
	}

	if err := updateDayVersion(ctx, log, tx, existingDayId, dayNewVersion); err != nil {
		return err
	}
	return nil
}
