package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/sirupsen/logrus"
	"github.com/themichaellai/cpa/server/db"
)

type mutationAddDay struct {
	Date string `json:"date"`
	Id   string `json:"id"`
}

type mutationSetWakeUp struct {
	Date   string
	Id     string
	Time   time.Time
	TimeTz *time.Location
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

func parseMutationSetWakeUp(bs []byte) (mutationSetWakeUp, error) {
	type mutationSetWakeUpRaw struct {
		Date string `json:"date"`
		Id   string `json:"id"`
		Time string `json:"time"`
	}
	var args mutationSetWakeUpRaw
	if err := json.Unmarshal(bs, &args); err != nil {
		msg := "could not unmarshal set wake up args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return mutationSetWakeUp{}, fmt.Errorf("%s: %w", msg, err)
	}
	t, tz, err := parseJavaTimeString(args.Time)
	if err != nil {
		return mutationSetWakeUp{}, fmt.Errorf("could not parse wake up: %w", err)
	}
	return mutationSetWakeUp{
		Date:   args.Date,
		Id:     args.Id,
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
	f func(tx *sqlx.Tx) (T, error),
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
	result, err := f(tx)
	if err != nil {
		return tt, err
	}
	if err := tx.Commit(); err != nil {
		return tt, fmt.Errorf("could not commit transaction: %w", err)
	}
	return result, nil
}

var dateRegexp = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

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
	us, err := runInTransaction(ctx, db, func(tx *sqlx.Tx) (userSpace, error) {
		u, err := getOrCreateUser(ctx, tx, userPassword)
		if err != nil {
			return userSpace{}, err
		}
		s, err := getOrCreateSpace(ctx, tx, u.Id)
		if err != nil {
			return userSpace{}, err
		}
		return userSpace{u, s}, nil
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
		if _, err := runInTransaction(ctx, dbClient, func(tx *sqlx.Tx) (struct{}, error) {
			//errorMode := false
			// 3. Read the ReplicacheClientGroup for body.clientGroupID from the
			// database, or default to: { id: body.clientGroupID, spaceID, userID }
			clientGroup, err := getClientGroup(ctx, tx, req.ClientGroupId)
			if err != nil {
				return struct{}{}, fmt.Errorf("could not get client group: %w", err)
			}
			if clientGroup != nil {
				// 4. Verify the requesting user owns the specified client group.
				if clientGroup.UserId != user.Id {
					return struct{}{}, UserError{
						Message:         "client group not found",
						internalMessage: "client group not owned by user",
					}
				}
				// 5. Verify the specified client group is part of the requesting space.
				if clientGroup.SpaceExternalId != space.ExternalId {
					return struct{}{}, UserError{
						Message:         "client group not found",
						internalMessage: "client group not in space",
					}
				}
			}

			// 6. Read the ReplicacheClient for mutation.clientID or default to: ...
			// { id: mutation.clientID, clientGroupID: body.clientGroupID, lastMutationID: 0, lastModifiedVersion }
			replicacheClient, hasReplicacheClient, err := db.ReplicacheClientGet(ctx, tx, mutation.ClientId)
			if err != nil {
				return struct{}{}, err
			}
			var nextMutationID int64 = 1
			if hasReplicacheClient {
				// 7. Verify the requesting client group owns the requested client.
				if replicacheClient.ClientGroupExternalId != req.ClientGroupId {
					return struct{}{}, UserError{Message: "replicache client not found"}
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
				return struct{}{}, fmt.Errorf("mutation already processed")
			}
			// 12. Rollback transaction and error if mutation from the future
			// (mutation.id > nextMutationID)
			if mutation.Id > nextMutationID {
				return struct{}{}, fmt.Errorf("mutation from the future")
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
						return struct{}{}, fmt.Errorf("%s: %w", msg, err)
					}
					if !dateRegexp.MatchString(args.Date) {
						return struct{}{}, fmt.Errorf("invalid date format: \"%s\"", args.Date)
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
							return struct{}{}, fmt.Errorf("could not query day: %w", err)
						}
						if _, err := tx.ExecContext(ctx, `
              INSERT INTO days (
                external_id,
                space_id,
                date,
                last_modified_version
              ) VALUES ($1, $2, $3, $4)
            `, args.Id, space.Id, args.Date, nextVersion); err != nil {
							return struct{}{}, fmt.Errorf("could not insert day: %w", err)
						}
					} else {
						if dayExisting.ExternalId != args.Id {
							errMsg := "day already exists with different id"
							log.WithFields(logrus.Fields{
								"external_id_req": args.Id,
								"external_id_db":  dayExisting.ExternalId,
							}).Error(errMsg)
							return struct{}{}, fmt.Errorf(errMsg)
						}
					}
				}
			case "setWakeUp":
				{
					mutationSetWakeUp, err := parseMutationSetWakeUp(mutation.Args)
					if err != nil {
						return struct{}{}, err
					}
					log.WithFields(logrus.Fields{
						"space_id": space.Id,
						"args":     mutationSetWakeUp,
					}).Info("running set wake up mutation")
					if err := db.SetWakeUpTime(
						ctx,
						tx,
						space.Id,
						nextVersion,
						mutationSetWakeUp.Date,
						mutationSetWakeUp.Id,
						mutationSetWakeUp.Time,
						mutationSetWakeUp.TimeTz,
					); err != nil {
						return struct{}{}, fmt.Errorf("could not set wake up time: %w", err)
					}
				}
			default:
				return struct{}{}, fmt.Errorf("unknown mutation: \"%s\"", mutation.Name)
			}

			// 14. Write updated ReplicacheSpace
			if err := db.SetSpaceVersion(ctx, tx, space.Id, nextVersion); err != nil {
				return struct{}{}, fmt.Errorf("could not set space version: %w", err)
			}
			// 15. Write ReplicacheClientGroup:
			clientGroupId, err := db.ReplicacheClientGroupGetOrCreate(ctx, tx, req.ClientGroupId, int64(space.Id), space.UserId)
			if err != nil {
				return struct{}{}, err
			}
			// 16. Write ReplicacheClient:
			if err := db.ReplicacheClientSet(ctx, tx, mutation.ClientId, int32(clientGroupId), nextMutationID, nextVersion); err != nil {
				return struct{}{}, err
			}
			return struct{}{}, nil
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
