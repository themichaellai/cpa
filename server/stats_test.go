package main

import (
	"context"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	dbpkg "github.com/themichaellai/cpa/server/db"
)

func TestGetGlobalUsageStats(t *testing.T) {
	db := setUpDb(t)

	// Test with no data - should return all zeros
	globalStats, err := runInTransaction(context.Background(), db, func(tx *sqlx.Tx) (dbpkg.UsageStats, bool, error) {
		stats, err := dbpkg.GetGlobalUsageStats(context.Background(), tx)
		if err != nil {
			return dbpkg.UsageStats{}, false, err
		}
		return stats, false, nil
	})
	require.Nil(t, err)
	assert.Equal(t, dbpkg.UsageStats{
		DailyUsage:   0,
		WeeklyUsage:  0,
		MonthlyUsage: 0,
	}, globalStats)

	// Create two different users with data
	today := time.Now().Format("2006-01-02")

	// User 1 data
	mutationArgsRaw1 := jsonEncode(map[string]interface{}{
		"id":   "day-today-user1",
		"date": today,
		"wakeUp": map[string]interface{}{
			"time": "2024-09-05T07:30:00.000+08:00[Asia/Taipei]",
		},
	})
	_, err = push(context.Background(), db, "test-user1", pushRequest{
		ClientGroupId: "test-client-group-1",
		Mutations: []mutation{
			{
				ClientId:  "test-client-1",
				Id:        1,
				Name:      "setDay",
				Args:      mutationArgsRaw1,
				Timestamp: 129289,
			},
		},
	})
	require.Nil(t, err)

	// User 2 data
	mutationArgsRaw2 := jsonEncode(map[string]interface{}{
		"id":   "day-today-user2",
		"date": today,
		"wakeUp": map[string]interface{}{
			"time": "2024-09-05T08:00:00.000+08:00[Asia/Taipei]",
		},
	})
	_, err = push(context.Background(), db, "test-user2", pushRequest{
		ClientGroupId: "test-client-group-2",
		Mutations: []mutation{
			{
				ClientId:  "test-client-2",
				Id:        1,
				Name:      "setDay",
				Args:      mutationArgsRaw2,
				Timestamp: 129290,
			},
		},
	})
	require.Nil(t, err)

	// Check global stats - should show usage from both users
	globalStats, err = runInTransaction(context.Background(), db, func(tx *sqlx.Tx) (dbpkg.UsageStats, bool, error) {
		stats, err := dbpkg.GetGlobalUsageStats(context.Background(), tx)
		if err != nil {
			return dbpkg.UsageStats{}, false, err
		}
		return stats, false, nil
	})
	require.Nil(t, err)

	// Should show 2 spaces with usage (one from each user)
	assert.Equal(t, dbpkg.UsageStats{
		DailyUsage:   2,
		WeeklyUsage:  2,
		MonthlyUsage: 2,
	}, globalStats)
}
