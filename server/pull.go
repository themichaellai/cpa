package main

import (
	"context"
	"fmt"
	"time"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	"github.com/themichaellai/cpa/gen/model"
	. "github.com/themichaellai/cpa/gen/table"
)

type pullRequest struct {
	// Version of the type Replicache uses for the response JSON. The current
	// version is 1.
	PullVersion   int64  `json:"pullVersion"`
	ClientGroupId string `json:"clientGroupID"`
	// The cookie that was received last time a pull was done. null if this is
	// the first pull from this client.
	Cookie        *int64 `json:"cookie"`
	ProfileID     string `json:"profileID"`
	SchemaVersion string `json:"schemaVersion"`
}

// type PatchOperation =
//
//	| {
//	    op: 'put';
//	    key: string;
//	    value: JSONValue;
//	  }
//	| {op: 'del'; key: string}
//	| {op: 'clear'};
type patchOperationPut struct {
	Op    string      `json:"op"`
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}
type pullResponse struct {
	Cookie                int64            `json:"cookie"`
	LastMutationIdChanges map[string]int32 `json:"lastMutationIDChanges"`
	Patch                 []interface{}    `json:"patch"`
}

type dayDb struct {
	model.Days
	Poops []model.Poops
}

func getDays(
	ctx context.Context,
	tx *sqlx.Tx,
	spaceId int64,
	previousVersion int64,
) ([]dayDb, error) {
	stmt := sqlite.SELECT(Days.AllColumns).FROM(Days).
		WHERE(Days.DeletedAt.IS_NULL().
			AND(Days.SpaceID.EQ(sqlite.Int64(spaceId))).
			AND(Days.LastModifiedVersion.GT(sqlite.Int64(previousVersion))),
		)
	var days []dayDb
	if err := stmt.QueryContext(ctx, tx, &days); err != nil {
		return nil, fmt.Errorf("could not get days: %w", err)
	}
	return days, nil
}

type poopResp struct {
	Time            string `json:"time"`
	TimeIntoDayMins *int32 `json:"time_into_day_mins"`
}

type wakeUpResp struct {
	Time string `json:"time"`
}

type dinnerResp struct {
	Size *string `json:"size"`
}
type dayResp struct {
	Id         string      `json:"id"`
	Date       string      `json:"date"`
	CoffeeTime *string     `json:"coffeeTime"`
	Dinner     *dinnerResp `json:"dinner"`
	WakeUpTime *wakeUpResp `json:"wakeUp"`
	Poops      []poopResp  `json:"poops"`
}

func dayDbToResp(day dayDb) (dayResp, error) {
	var wakeUpTime *wakeUpResp
	if day.WakeUpTime != nil && day.WakeUpTimeTz != nil {
		loc, err := time.LoadLocation(*day.WakeUpTimeTz)
		if err != nil {
			return dayResp{}, fmt.Errorf("could not load location from db: %w", err)
		}
		t, err := time.ParseInLocation("2006-01-02 15:04:05", *day.WakeUpTime, loc)
		if err != nil {
			return dayResp{}, fmt.Errorf("unexpected db time format \"%s\": %w", *day.WakeUpTime, err)
		}
		wakeUpTime = &wakeUpResp{
			Time: fmt.Sprintf("%s[%s]", t.Format(time.RFC3339), *day.WakeUpTimeTz),
		}
	}
	return dayResp{
		Id:         day.ExternalID,
		Date:       day.Date,
		CoffeeTime: day.CoffeeTime,
		Dinner: &dinnerResp{
			Size: day.DinnerSize,
		},
		WakeUpTime: wakeUpTime,
		Poops: func() []poopResp {
			poops := []poopResp{}
			for _, poop := range day.Poops {
				poops = append(poops, poopResp{
					Time:            poop.Time,
					TimeIntoDayMins: poop.TimeIntoDayMinutes,
				})
			}
			return poops
		}(),
	}, nil
}

func getUpdatedClients(
	context context.Context,
	tx *sqlx.Tx,
	clientGroupId int64,
	previousVersion int64,
) ([]model.ReplicacheClients, error) {
	stmt := sqlite.SELECT(ReplicacheClients.AllColumns).FROM(ReplicacheClients).
		WHERE(ReplicacheClients.ReplicacheClientGroupID.EQ(sqlite.Int64(clientGroupId)).
			AND(ReplicacheClients.LastModifiedVersion.GT(sqlite.Int64(previousVersion))),
		)
	var clients []model.ReplicacheClients
	if err := stmt.Query(tx, &clients); err != nil {
		return nil, fmt.Errorf("could not get clients: %w", err)
	}
	return clients, nil
}

func pull(
	ctx context.Context,
	db *sqlx.DB,
	userPassword string,
	req pullRequest,
) (pullResponse, error) {
	user, space, err := getUserAndSpace(ctx, db, userPassword)
	if err != nil {
		return pullResponse{}, err
	}
	pullResp, err := runInTransaction(ctx, db, func(tx *sqlx.Tx) (pullResponse, bool, error) {
		var previousVersion int64 = 0
		if req.Cookie != nil {
			previousVersion = *req.Cookie
		}
		clientGroup, err := getClientGroup(ctx, tx, req.ClientGroupId)
		if err != nil {
			return pullResponse{}, false, err
		}
		if clientGroup != nil {
			if clientGroup.UserId != user.Id {
				return pullResponse{}, false, UserError{
					Message:         "client group not found",
					internalMessage: "client group not owned by user",
				}
			}
			if clientGroup.SpaceExternalId != space.ExternalId {
				return pullResponse{}, false, UserError{
					Message:         "client group not found",
					internalMessage: "client group not in space",
				}
			}
		}
		// 7. Read all domain entities from the database that have spaceID ==
		// request.params.spaceID AND lastModifiedVersion > prevVersion
		days, err := getDays(ctx, tx, space.Id, previousVersion)
		if err != nil {
			return pullResponse{}, false, err
		}

		var clientGroupId int64 = -1
		if clientGroup != nil {
			clientGroupId = clientGroup.Id
		}
		// 8. Read all ReplicacheClient records for the requested client group that have lastModifiedVersion > prevVersion.
		clients, err := getUpdatedClients(ctx, tx, clientGroupId, previousVersion)
		if err != nil {
			return pullResponse{}, false, err
		}
		lastMutationIdChanges := map[string]int32{}
		for _, client := range clients {
			lastMutationIdChanges[client.ExternalID] = client.LastMutationID
		}
		patches := []interface{}{}
		for _, d := range days {
			putResp, err := dayDbToResp(d)
			if err != nil {
				return pullResponse{}, false, err
			}
			patches = append(patches, patchOperationPut{
				Op:    "put",
				Key:   fmt.Sprintf("day/%s", d.ExternalID),
				Value: putResp,
			})
		}

		return pullResponse{
			Cookie:                space.Version,
			LastMutationIdChanges: lastMutationIdChanges,
			Patch:                 patches,
		}, false, nil

	})
	if err != nil {
		return pullResponse{}, err
	}
	return pullResp, nil
}
