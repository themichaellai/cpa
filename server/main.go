package main

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	_ "github.com/mattn/go-sqlite3"
	"github.com/plaid/go-envvar/envvar"
)

type envVars struct {
	DbPath string `envvar:"DB_PATH"`
}

func run() error {
	var env envVars
	if err := envvar.Parse(&env); err != nil {
		return fmt.Errorf("could not parse env vars: %w", err)
	}

	db, err := sql.Open("sqlite3", env.DbPath)
	if err != nil {
		return fmt.Errorf("could not open database: %w", err)
	}
	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		_, err = db.Query("select 1")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "error",
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})
	return r.Run() // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}

func main() {
	if err := run(); err != nil {
		panic(err)
	}
}
