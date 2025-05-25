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

func TestPushSetDayV2(t *testing.T) {
	db := setUpDb(t)
	clientGroupId := "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4"
	clientId := "3a26098a-967e-43ff-8900-ae1812ad8ee0"

	mutationArgsRaw := jsonEncode(map[string]interface{}{
		"id":   "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
		"date": "2024-09-05",
		"wakeUp": map[string]interface{}{
			"time": "2024-09-05T09:49:41.952+08:00[Asia/Taipei]",
		},
		"dinner": map[string]interface{}{
			"size": "big",
		},
	})
	_, err := push(context.Background(), db, "test", pushRequest{
		ClientGroupId: clientGroupId,
		Mutations: []mutation{
			{
				ClientId:  clientId,
				Id:        1,
				Name:      "setDayV2",
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

	dinnerSize := "big"
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
						Size: &dinnerSize,
					},
					WakeUpTime: &wakeUpResp{
						Time: "2024-09-05T09:49:41+08:00[Asia/Taipei]",
					},
					Poops:   []poopResp{},
					Comment: nil, // setDayV2 should not set comment, so it remains nil
				},
			},
		},
	}, pullResp)
}

func TestPushSetComment(t *testing.T) {
	db := setUpDb(t)
	clientGroupId := "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4"
	clientId := "3a26098a-967e-43ff-8900-ae1812ad8ee0"

	comment := "This is a test comment"
	mutationArgsRaw := jsonEncode(map[string]interface{}{
		"id":      "80491861-aeb7-4c7f-bdce-81fb7bbf5737",
		"date":    "2024-09-05",
		"comment": comment,
	})
	_, err := push(context.Background(), db, "test", pushRequest{
		ClientGroupId: clientGroupId,
		Mutations: []mutation{
			{
				ClientId:  clientId,
				Id:        1,
				Name:      "setComment",
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
					WakeUpTime: nil, // setComment should not modify wake up time, so it remains nil
					Poops:      []poopResp{},
					Comment:    &comment,
				},
			},
		},
	}, pullResp)
}

func TestPushSetDayV2AndSetComment(t *testing.T) {
	db := setUpDb(t)
	clientGroupId := "3387a3ad-8cc4-46d2-b191-b9caca7ae2d4"
	clientId1 := "client1-967e-43ff-8900-ae1812ad8ee0"
	clientId2 := "client2-967e-43ff-8900-ae1812ad8ee0"
	dayId := "80491861-aeb7-4c7f-bdce-81fb7bbf5737"
	date := "2024-09-05"

	// First client sets the comment for the day
	comment := "Great day!"
	mutationArgs1 := jsonEncode(map[string]interface{}{
		"id":      dayId,
		"date":    date,
		"comment": comment,
	})
	_, err := push(context.Background(), db, "test", pushRequest{
		ClientGroupId: clientGroupId,
		Mutations: []mutation{
			{
				ClientId:  clientId1,
				Id:        1,
				Name:      "setComment",
				Args:      mutationArgs1,
				Timestamp: 129289,
			},
		},
	})
	require.Nil(t, err)

	// Second client sets wake up and dinner using setDayV2 (which doesn't touch comment)
	mutationArgs2 := jsonEncode(map[string]interface{}{
		"id":   dayId,
		"date": date,
		"wakeUp": map[string]interface{}{
			"time": "2024-09-05T07:30:00.000+08:00[Asia/Taipei]",
		},
		"dinner": map[string]interface{}{
			"size": "big",
		},
	})
	_, err = push(context.Background(), db, "test", pushRequest{
		ClientGroupId: clientGroupId,
		Mutations: []mutation{
			{
				ClientId:  clientId2,
				Id:        1,
				Name:      "setDayV2",
				Args:      mutationArgs2,
				Timestamp: 129300,
			},
		},
	})
	require.Nil(t, err)

	// Pull and verify both mutations are applied without overriding each other
	var cookie int64 = 0
	pullResp, err := pull(context.Background(), db, "test", pullRequest{
		PullVersion:   1,
		ClientGroupId: clientGroupId,
		Cookie:        &cookie,
		ProfileID:     "pc47c02e442514630b2b20570ddace55f",
		SchemaVersion: "",
	})
	require.Nil(t, err)

	// Verify that both clients' mutation IDs are tracked
	expectedLastMutationIdChanges := map[string]int32{
		clientId1: 1,
		clientId2: 1,
	}
	assert.Equal(t, expectedLastMutationIdChanges, pullResp.LastMutationIdChanges)

	// Verify that both the comment and wake up time/dinner are set
	dinnerSize := "big"
	expectedPatch := []interface{}{
		patchOperationPut{
			Op:  "put",
			Key: "day/" + dayId,
			Value: dayResp{
				Id:         dayId,
				Date:       date,
				CoffeeTime: nil,
				Dinner: &dinnerResp{
					Size: &dinnerSize,
				},
				WakeUpTime: &wakeUpResp{
					Time: "2024-09-05T07:30:00+08:00[Asia/Taipei]",
				},
				Poops:   []poopResp{},
				Comment: &comment, // Comment should be preserved!
			},
		},
	}
	assert.Equal(t, expectedPatch, pullResp.Patch)
	assert.Equal(t, int64(2), pullResp.Cookie) // Should be 2 since we have 2 mutations
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
