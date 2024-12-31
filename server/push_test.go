package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func jsonEncode(m map[string]interface{}) []byte {
	bs, err := json.Marshal(m)
	if err != nil {
		panic(err)
	}
	return bs
}

func TestPushAddPoop(t *testing.T) {
	db := setUpDb(t)

	mutationArgsRaw := jsonEncode(map[string]interface{}{
		"poopId": "f25411c9-bb88-4e03-9a00-2b4410f93e0f",
		"id":     "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
		"date":   "2024-09-05",
		"time":   "2024-09-05T09:49:41.952+08:00[Asia/Taipei]",
	})
	_, err := push(context.Background(), db, "test", pushRequest{
		ClientGroupId: "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4",
		Mutations: []mutation{
			{
				ClientId:  "3a26098a-967e-43ff-8900-ae1812ad8ee0",
				Id:        1,
				Name:      "addPoop",
				Args:      mutationArgsRaw,
				Timestamp: 129289,
			},
		},
	})
	require.Nil(t, err)

	var cookie int64 = 0
	pullResp, err := pull(context.Background(), db, "test", pullRequest{
		PullVersion:   1,
		ClientGroupId: "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4",
		Cookie:        &cookie,
		ProfileID:     "pc47c02e442514630b2b20570ddace55f",
		SchemaVersion: "",
	})
	require.Nil(t, err)
	assert.Equal(t, pullResponse{
		Cookie: 1,
		LastMutationIdChanges: map[string]int32{
			"3a26098a-967e-43ff-8900-ae1812ad8ee0": 1,
		},
		Patch: []interface{}{
			patchOperationPut{
				Op:  "put",
				Key: "day/80491861-aeb7-4c7f-bdce-81fb7bbf5737",
				Value: dayResp{
					Id:         "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
					Date:       "2024-09-05",
					CoffeeTime: nil,
					Dinner: &dinnerResp{
						Size: nil,
					},
					WakeUpTime: nil,
					Poops: []poopResp{
						{
							Id:   "f25411c9-bb88-4e03-9a00-2b4410f93e0f",
							Time: "2024-09-05T09:49:41+08:00[Asia/Taipei]",
							Run:  nil,
						},
					},
					Comment: nil,
				},
			},
		},
	}, pullResp)
}

func TestPushSetDay(t *testing.T) {
	db := setUpDb(t)
	clientGroupId := "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4"
	clientId := "3a26098a-967e-43ff-8900-ae1812ad8ee0"

	comment := "hello"
	mutationArgsRaw := jsonEncode(map[string]interface{}{
		"id":   "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
		"date": "2024-09-05",
		"wakeUp": map[string]interface{}{
			"time": "2024-09-05T09:49:41.952+08:00[Asia/Taipei]",
		},
		"dinner":  nil,
		"comment": comment,
	})
	_, err := push(context.Background(), db, "test", pushRequest{
		ClientGroupId: clientGroupId,
		Mutations: []mutation{
			{
				ClientId:  clientId,
				Id:        1,
				Name:      "setDay",
				Args:      mutationArgsRaw,
				Timestamp: 129289,
			},
		},
	})
	require.Nil(t, err)

	var cookie int64 = 0
	pullResp, err := pull(context.Background(), db, "test", pullRequest{
		PullVersion:   1,
		ClientGroupId: clientGroupId,
		Cookie:        &cookie,
		ProfileID:     "pc47c02e442514630b2b20570ddace55f",
		SchemaVersion: "",
	})
	require.Nil(t, err)
	assert.Equal(t, pullResponse{
		Cookie: 1,
		LastMutationIdChanges: map[string]int32{
			clientId: 1,
		},
		Patch: []interface{}{
			patchOperationPut{
				Op:  "put",
				Key: "day/80491861-aeb7-4c7f-bdce-81fb7bbf5737",
				Value: dayResp{
					Id:         "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
					Date:       "2024-09-05",
					CoffeeTime: nil,
					Dinner: &dinnerResp{
						Size: nil,
					},
					WakeUpTime: &wakeUpResp{
						Time: "2024-09-05T09:49:41+08:00[Asia/Taipei]",
					},
					Poops:   []poopResp{},
					Comment: &comment,
				},
			},
		},
	}, pullResp)
}

func setUpDb(t *testing.T) *sqlx.DB {
	db, err := sqlx.Open("sqlite3", ":memory:")
	if err != nil {
		panic(fmt.Errorf("error opening sqlite db: %w", err))
	}
	require.Nil(t, goose.SetDialect("sqlite3"))
	if err := goose.Up(db.DB, "../migrations"); err != nil {
		panic(fmt.Errorf("error migrating: %w", err))
	}
	return db
}
