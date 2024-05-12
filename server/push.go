package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"github.com/themichaellai/cpa/server/db"
)

var validate *validator.Validate

func init() {
	validate = validator.New()
}

type mutationAddDay struct {
	Date string `json:"date"`
	Id   string `json:"id"`
}

type mutationSetDay struct {
	Date         db.ParsedDate
	Id           string
	WakeUpTime   *time.Time
	WakeUpTimeTz *time.Location
	DinnerSize   *db.DinnerSize
}

var timeZoneRegexp = regexp.MustCompile(`^([^[]+)\[(.+)\]$`)

func parseJavaTimeString(s string) (t time.Time, timezone *time.Location, _ error) {
	timeStringMatch := timeZoneRegexp.FindStringSubmatch(s)
	if timeStringMatch == nil {
		return time.Time{}, nil, fmt.Errorf("could not parse time")
	}
	t, err := time.Parse(time.RFC3339, timeStringMatch[1])
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("invalid time format: %w", err)
	}
	loc, err := time.LoadLocation(timeStringMatch[2])
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("invalid timezone: %w", err)
	}
	return t, loc, nil
}

func parseMutationSetDay(bs []byte) (mutationSetDay, error) {
	type mutationSetDayRaw struct {
		Date   string `json:"date"`
		Id     string `json:"id"`
		WakeUp *struct {
			Time *string `json:"time"`
		} `json:"wakeUp"`
		Dinner *struct {
			Size *string `json:"size"`
		} `json:"dinner"`
	}
	var args mutationSetDayRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal set wake up args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return mutationSetDay{}, fmt.Errorf("%s: %w", msg, err)
	}
	var wakeUpTime *time.Time
	var wakeUpTimeTz *time.Location
	if args.WakeUp != nil && args.WakeUp.Time != nil {
		t, tz, err := parseJavaTimeString(*args.WakeUp.Time)
		if err != nil {
			return mutationSetDay{}, fmt.Errorf("could not parse wake up: %w", err)
		}
		log.WithFields(logrus.Fields{
			"time": t.Format(time.RFC3339),
			"tz":   tz.String(),
		}).Info("parsed wake up time")
		wakeUpTime = &t
		wakeUpTimeTz = tz
	}
	var dinnerSize *db.DinnerSize
	if args.Dinner != nil && args.Dinner.Size != nil {
		dinnerSizeParsed, dinnerSizeOk := db.ParseToDinnerSize(*args.Dinner.Size)
		if !dinnerSizeOk {
			return mutationSetDay{}, fmt.Errorf("invalid dinner size: %s", *args.Dinner.Size)
		}
		dinnerSize = &dinnerSizeParsed
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return mutationSetDay{}, err
	}
	return mutationSetDay{
		Date:         date,
		Id:           args.Id,
		WakeUpTime:   wakeUpTime,
		WakeUpTimeTz: wakeUpTimeTz,
		DinnerSize:   dinnerSize,
	}, nil
}

type mutationAddPoop struct {
	PoopId string
	DayId  string
	Date   db.ParsedDate
	Time   time.Time
	TimeTz *time.Location
}

func newJsonDecoder(bs []byte) *json.Decoder {
	decoder := json.NewDecoder(bytes.NewReader(bs))
	decoder.DisallowUnknownFields()
	return decoder
}

func parseMutationAddPoop(bs []byte) (mutationAddPoop, error) {
	type mutationAddPoopRaw struct {
		PoopId string `json:"poopId" validate:"required"`
		DayId  string `json:"id" validate:"required"`
		Date   string `json:"date" validate:"required"`
		Time   string `json:"time" validate:"required"`
	}
	var args mutationAddPoopRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal add poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return mutationAddPoop{}, fmt.Errorf("%s: %w", msg, err)
	}
	if err := validate.Struct(args); err != nil {
		return mutationAddPoop{}, fmt.Errorf("invalid add poop args: %w", err)
	}
	t, tz, err := parseJavaTimeString(args.Time)
	if err != nil {
		return mutationAddPoop{}, fmt.Errorf("could not parse time: %w", err)
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return mutationAddPoop{}, err
	}
	return mutationAddPoop{
		DayId:  args.DayId,
		PoopId: args.PoopId,
		Date:   date,
		Time:   t,
		TimeTz: tz,
	}, nil
}

type pushRequest struct {
	ClientGroupId string     `json:"clientGroupID"`
	Mutations     []mutation `json:"mutations"`
}

type mutation struct {
	ClientId string          `json:"clientId"`
	Id       int64           `json:"id"`
	Name     string          `json:"name"`
	Args     json.RawMessage `json:"args"`
	// The DOMHighResTimeStamp from the source client when the mutation was
	// initially run. This field is not currently used by the protocol.
	Timestamp float64 `json:"timestamp"`
}

type pushResponse struct {
	Foo string `json:"foo"`
}

type clientGroupRow struct {
	Id              int64  `db:"id" json:"-"`
	ExternalId      string `db:"external_id"`
	SpaceExternalId string `db:"space_external_id"`
	UserId          int64  `db:"user_id"`
}

type space struct {
	Id         int64  `db:"id"`
	ExternalId string `db:"external_id"`
	UserId     int64  `db:"user_id"`
	Version    int64  `db:"version"`
}

type UserError struct {
	internalMessage string
	Message         string
}

func (e UserError) Error() string {
	return e.Message
}

func runInTransaction[T any](
	ctx context.Context,
	db *sqlx.DB,
	f func(tx *sqlx.Tx) (_ T, rollback bool, _ error),
) (T, error) {
	var tt T
	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return tt, fmt.Errorf("could not begin transaction: %w", err)
	}
	defer func() {
		if err := tx.Rollback(); err != nil {
			if err != sql.ErrTxDone {
				log.WithFields(logrus.Fields{
					"err": err,
				}).Error("could not rollback")
			}
		}
	}()
	result, shouldRollback, err := f(tx)
	if err != nil || shouldRollback {
		return tt, err
	}
	if err := tx.Commit(); err != nil {
		return tt, fmt.Errorf("could not commit transaction: %w", err)
	}
	return result, nil
}

func getOrCreateSpace(
	ctx context.Context,
	tx *sqlx.Tx,
	userId int64,
) (space, error) {
	var s space
	if err := tx.GetContext(ctx, &s, `
    SELECT
      id,
      external_id,
      version,
      user_id
    from spaces
    where user_id=$1
  `, userId); err != nil {
		if err != sql.ErrNoRows {
			return space{}, fmt.Errorf("could not query space: %w", err)
		}
		newSpaceExternalId, err := uuid.NewRandom()
		if err != nil {
			return space{}, fmt.Errorf("getOrCreateSpace: %w", err)
		}
		var newSpace space
		if err := tx.GetContext(ctx, &newSpace, `
      INSERT INTO spaces (external_id, version, user_id)
      VALUES ($1, $2, $3)
      RETURNING id, external_id, version, user_id
    `, newSpaceExternalId, 0, userId); err != nil {
			return space{}, fmt.Errorf("could not insert space: %w", err)
		}
		return newSpace, nil
	}
	return s, nil
}

func getClientGroup(
	ctx context.Context,
	tx *sqlx.Tx,
	clientGroupId string,
) (*clientGroupRow, error) {
	var clientGroup clientGroupRow
	if err := tx.GetContext(ctx, &clientGroup, `
    SELECT
      replicache_client_groups.id as "id",
      replicache_client_groups.external_id as "external_id",
      spaces.external_id as "space_external_id",
      replicache_client_groups.user_id as "user_id"
    from replicache_client_groups
    join spaces
      on replicache_client_groups.space_id = spaces.id
    where replicache_client_groups.external_id=$1
  `, clientGroupId); err != nil {
		if err != sql.ErrNoRows {
			return nil, fmt.Errorf("could not query client group: %w", err)
		}
		return nil, nil
	}
	return &clientGroup, nil
}

func getUserAndSpace(
	ctx context.Context,
	db *sqlx.DB,
	userPassword string,
) (user, space, error) {
	type userSpace struct {
		user  user
		space space
	}
	us, err := runInTransaction(ctx, db, func(tx *sqlx.Tx) (userSpace, bool, error) {
		u, err := getOrCreateUser(ctx, tx, userPassword)
		if err != nil {
			return userSpace{}, false, err
		}
		s, err := getOrCreateSpace(ctx, tx, u.Id)
		if err != nil {
			return userSpace{}, false, err
		}
		return userSpace{u, s}, false, nil
	})
	if err != nil {
		return user{}, space{}, err
	}
	return us.user, us.space, nil
}

func push(
	ctx context.Context,
	dbClient *sqlx.DB,
	userPassword string,
	req pushRequest,
) (pushResponse, error) {
	user, space, err := getUserAndSpace(ctx, dbClient, userPassword)
	if err != nil {
		return pushResponse{}, err
	}
	for _, mutation := range req.Mutations {
		if _, err := runInTransaction(ctx, dbClient, func(tx *sqlx.Tx) (struct{}, bool, error) {
			//errorMode := false
			// 3. Read the ReplicacheClientGroup for body.clientGroupID from the
			// database, or default to: { id: body.clientGroupID, spaceID, userID }
			clientGroup, err := getClientGroup(ctx, tx, req.ClientGroupId)
			if err != nil {
				return struct{}{}, false, fmt.Errorf("could not get client group: %w", err)
			}
			if clientGroup != nil {
				// 4. Verify the requesting user owns the specified client group.
				if clientGroup.UserId != user.Id {
					return struct{}{}, false, UserError{
						Message:         "client group not found",
						internalMessage: "client group not owned by user",
					}
				}
				// 5. Verify the specified client group is part of the requesting space.
				if clientGroup.SpaceExternalId != space.ExternalId {
					return struct{}{}, false, UserError{
						Message:         "client group not found",
						internalMessage: "client group not in space",
					}
				}
			}

			// 6. Read the ReplicacheClient for mutation.clientID or default to: ...
			// { id: mutation.clientID, clientGroupID: body.clientGroupID, lastMutationID: 0, lastModifiedVersion }
			replicacheClient, hasReplicacheClient, err := db.ReplicacheClientGet(ctx, tx, mutation.ClientId)
			if err != nil {
				return struct{}{}, false, err
			}
			var nextMutationID int64 = 1
			if hasReplicacheClient {
				// 7. Verify the requesting client group owns the requested client.
				if replicacheClient.ClientGroupExternalId != req.ClientGroupId {
					return struct{}{}, false, UserError{Message: "replicache client not found"}
				}
				nextMutationID = replicacheClient.LastMutationId + 1
			}
			// 9. Read the ReplicacheSpace for request.params.spaceID
			// Associating space with user - done earlier

			// 10. let nextVersion = replicacheSpace.version + 1
			nextVersion := space.Version + 1
			// 11. Rollback transaction and skip this mutation if already processed
			// (mutation.id < nextMutationID)
			if mutation.Id < nextMutationID {
				log.WithFields(logrus.Fields{
					"mutation_id":      mutation.Id,
					"next_mutation_id": nextMutationID,
				}).Warn("mutation already processed")
				return struct{}{}, true, nil
			}
			// 12. Rollback transaction and error if mutation from the future
			// (mutation.id > nextMutationID)
			if mutation.Id > nextMutationID {
				err := fmt.Errorf("mutation from the future")
				log.WithFields(logrus.Fields{
					"mutation_id":      mutation.Id,
					"next_mutation_id": nextMutationID,
				}).Info(err.Error())
				return struct{}{}, false, err
			}

			switch mutation.Name {
			case "addDay":
				{
					var args mutationAddDay
					if err := json.Unmarshal(mutation.Args, &args); err != nil {
						msg := "could not unmarshal add day args"
						log.WithFields(logrus.Fields{
							"args": string(mutation.Args),
						}).Error(msg)
						return struct{}{}, false, fmt.Errorf("%s: %w", msg, err)
					}
					if _, err := db.ParseDateFromString(args.Date); err != nil {
						return struct{}{}, false, err
					}
					log.WithFields(logrus.Fields{
						"space_id": space.Id,
						"args":     args,
					}).Info("running add day mutation")
					type day struct {
						Id         string `db:"id"`
						ExternalId string `db:"external_id"`
						Date       string `db:"date"`
						SpaceId    int64  `db:"space_id"`
					}
					var dayExisting day
					if err := tx.GetContext(ctx, &dayExisting, `
            SELECT
              id,
              external_id,
              date,
              space_id
            from days
            where
              date=$1 and
              space_id=$2
          `, args.Date, space.Id); err != nil {
						if err != sql.ErrNoRows {
							return struct{}{}, false, fmt.Errorf("could not query day: %w", err)
						}
						if _, err := tx.ExecContext(ctx, `
              INSERT INTO days (
                external_id,
                space_id,
                date,
                last_modified_version
              ) VALUES ($1, $2, $3, $4)
            `, args.Id, space.Id, args.Date, nextVersion); err != nil {
							return struct{}{}, false, fmt.Errorf("could not insert day: %w", err)
						}
					} else {
						if dayExisting.ExternalId != args.Id {
							errMsg := "day already exists with different id"
							log.WithFields(logrus.Fields{
								"external_id_req": args.Id,
								"external_id_db":  dayExisting.ExternalId,
							}).Error(errMsg)
							return struct{}{}, false, fmt.Errorf(errMsg)
						}
					}
				}
			case "setDay":
				{
					mutationSetWakeUp, err := parseMutationSetDay(mutation.Args)
					if err != nil {
						return struct{}{}, false, err
					}
					log.WithFields(logrus.Fields{
						"space_id": space.Id,
						"args":     fmt.Sprintf("%#v", mutationSetWakeUp),
					}).Info("running set day mutation")
					if err := db.SetDay(
						ctx,
						tx,
						space.Id,
						nextVersion,
						mutationSetWakeUp.Date,
						mutationSetWakeUp.Id,
						mutationSetWakeUp.WakeUpTime,
						mutationSetWakeUp.WakeUpTimeTz,
						mutationSetWakeUp.DinnerSize,
					); err != nil {
						return struct{}{}, false, fmt.Errorf("could not set wake up time: %w", err)
					}
				}
			case "addPoop":
				{
					mutationAddPoop, err := parseMutationAddPoop(mutation.Args)
					if err != nil {
						return struct{}{}, false, err
					}
					log.WithFields(logrus.Fields{
						"space_id": space.Id,
						"args":     fmt.Sprintf("%#v", mutationAddPoop),
					}).Info("running add poop mutation")
					if err := db.AddPoop(
						ctx,
						log,
						tx,
						space.Id,
						nextVersion,
						mutationAddPoop.DayId,
						mutationAddPoop.Date,
						mutationAddPoop.PoopId,
						mutationAddPoop.Time,
						mutationAddPoop.TimeTz,
					); err != nil {
						return struct{}{}, false, fmt.Errorf("could not add poop: %w", err)
					}
				}
			default:
				return struct{}{}, false, fmt.Errorf("unknown mutation: \"%s\"", mutation.Name)
			}

			// 14. Write updated ReplicacheSpace
			if err := db.SetSpaceVersion(ctx, tx, space.Id, nextVersion); err != nil {
				return struct{}{}, false, fmt.Errorf("could not set space version: %w", err)
			}
			// 15. Write ReplicacheClientGroup:
			clientGroupId, err := db.ReplicacheClientGroupGetOrCreate(ctx, tx, req.ClientGroupId, int64(space.Id), space.UserId)
			if err != nil {
				return struct{}{}, false, err
			}
			// 16. Write ReplicacheClient:
			if err := db.ReplicacheClientSet(ctx, tx, mutation.ClientId, int32(clientGroupId), nextMutationID, nextVersion); err != nil {
				return struct{}{}, false, err
			}
			return struct{}{}, false, nil
		}); err != nil {
			if userErr, ok := err.(UserError); ok {
				return pushResponse{}, userErr
			}
			return pushResponse{}, fmt.Errorf("could not run transaction: %w", err)
		}
	}

	return pushResponse{
		Foo: "bar",
	}, nil
}
