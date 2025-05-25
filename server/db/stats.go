package db

import (
	"context"
	"time"

	"github.com/go-jet/jet/v2/sqlite"
	"github.com/jmoiron/sqlx"
	. "github.com/themichaellai/cpa/gen/table"
)

type UsageStats struct {
	DailyUsage   int64 `json:"dailyUsage" db:"daily_usage"`
	WeeklyUsage  int64 `json:"weeklyUsage" db:"weekly_usage"`
	MonthlyUsage int64 `json:"monthlyUsage" db:"monthly_usage"`
}

func GetGlobalUsageStats(
	ctx context.Context,
	tx *sqlx.Tx,
) (UsageStats, error) {
	now := time.Now()

	// Calculate date boundaries
	today := now.Format("2006-01-02")
	weekAgo := now.AddDate(0, 0, -7).Format("2006-01-02")
	monthAgo := now.AddDate(0, -1, 0).Format("2006-01-02")

	// Count distinct spaces with data for each time period
	query, args := sqlite.
		SELECT(
			sqlite.COUNT(
				sqlite.DISTINCT(
					sqlite.CASE().
						WHEN(Days.Date.GT_EQ(sqlite.String(today))).
						THEN(Days.SpaceID).
						ELSE(sqlite.NULL),
				),
			).AS("daily_usage"),
			sqlite.COUNT(
				sqlite.DISTINCT(
					sqlite.CASE().
						WHEN(Days.Date.GT_EQ(sqlite.String(weekAgo))).
						THEN(Days.SpaceID).
						ELSE(sqlite.NULL),
				),
			).AS("weekly_usage"),
			sqlite.COUNT(
				sqlite.DISTINCT(
					sqlite.CASE().
						WHEN(Days.Date.GT_EQ(sqlite.String(monthAgo))).
						THEN(Days.SpaceID).
						ELSE(sqlite.NULL),
				),
			).AS("monthly_usage"),
		).
		FROM(Days.LEFT_JOIN(Poops, Poops.DayID.EQ(Days.ID).AND(Poops.DeletedAt.IS_NULL()))).
		WHERE(
			Days.DeletedAt.IS_NULL().
				AND(Days.Date.GT_EQ(sqlite.String(monthAgo))).
				AND(
					Days.WakeUpTime.IS_NOT_NULL().
						OR(Days.DinnerSize.IS_NOT_NULL()).
						OR(Days.Comment.IS_NOT_NULL()).
						OR(Poops.ID.IS_NOT_NULL()),
				),
		).
		Sql()

	var stats UsageStats
	if err := tx.GetContext(ctx, &stats, query, args...); err != nil {
		return UsageStats{}, err
	}

	return stats, nil
}
