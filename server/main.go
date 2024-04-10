package main

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/plaid/go-envvar/envvar"
	"github.com/sirupsen/logrus"
)

type envVars struct {
	DbPath string `envvar:"DB_PATH"`
}

var log = logrus.New()

func run() error {

	var env envVars
	if err := envvar.Parse(&env); err != nil {
		return fmt.Errorf("could not parse env vars: %w", err)
	}

	db, err := sqlx.Connect("sqlite3", env.DbPath)
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

	r.POST("/push", func(c *gin.Context) {
		var data pushRequest
		if err := c.BindJSON(&data); err != nil {
			log.WithFields(logrus.Fields{
				"err": err,
			}).Error("error")
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "error",
			})
			return
		}
		resp, err := push(c, db, "foobarbaz", "26915643-db30-4cec-87b0-e75d36a8138e", data)
		if err != nil {
			fields := logrus.Fields{
				"err": err,
			}
			var userErr UserError
			if errors.As(err, &userErr) {
				fmt.Println("internal message: ", userErr.internalMessage)
				fields["internal_message"] = userErr.internalMessage
			}
			log.WithFields(fields).Error("error in handler")
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "error",
			})
			return
		}
		c.JSON(http.StatusOK, resp)
	})

	return r.Run() // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}

func main() {
	if err := run(); err != nil {
		panic(err)
	}
}
