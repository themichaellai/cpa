package main

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"

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

var bearerRegexp = regexp.MustCompile(`^[Bb]earer (.+)$`)

func parseAuthFromHeader(c *gin.Context) (string, error) {
	auth := c.GetHeader("Authorization")
	if auth == "" {
		return "", fmt.Errorf("no Authorization header")
	}
	matches := bearerRegexp.FindStringSubmatch(auth)
	if matches == nil {
		return "", UserError{
			internalMessage: "invalid authorization header",
			Message:         "unauthorized",
		}
	}
	return matches[1], nil
}

func logError(err error) {
	fields := logrus.Fields{
		"err": err,
	}
	var userErr UserError
	if errors.As(err, &userErr) {
		fmt.Println("internal message: ", userErr.internalMessage)
		fields["internal_message"] = userErr.internalMessage
	}
	log.WithFields(fields).Error("error in handler")
}

func setCorsHeaders(c *gin.Context) {
	c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
	c.Header("Access-Control-Allow-Methods", "POST")
	c.Header("Access-Control-Allow-Headers", "*")
}

func setPragmas(db *sqlx.DB) {
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA cache_size = 1000000000;",
		"PRAGMA foreign_keys = ON;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA temp_store = memory;",
	}

	for _, pragma := range pragmas {
		_, err := db.Exec(pragma)
		if err != nil {
			log.Fatalf("Error setting PRAGMA %s: %v", pragma, err)
		}
	}
}

func run() error {
	var env envVars
	if err := envvar.Parse(&env); err != nil {
		return fmt.Errorf("could not parse env vars: %w", err)
	}

	db, err := sqlx.Connect("sqlite3", fmt.Sprintf("%s?_txlock=immediate", env.DbPath))
	if err != nil {
		return fmt.Errorf("could not open database: %w", err)
	}
	db.SetMaxOpenConns(1)
	setPragmas(db)

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

	r.OPTIONS("/push", func(c *gin.Context) {
		setCorsHeaders(c)
		c.Status(http.StatusOK)
	})

	r.POST("/push", func(c *gin.Context) {
		setCorsHeaders(c)
		auth, err := parseAuthFromHeader(c)
		if err != nil {
			logError(err)
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "unauthorized",
			})
			return
		}

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
		resp, err := push(c, db, auth, data)
		if err != nil {
			logError(err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"message": "error",
			})
			return
		}
		c.JSON(http.StatusOK, resp)
	})

	r.OPTIONS("/pull", func(c *gin.Context) {
		setCorsHeaders(c)
		c.Status(http.StatusOK)
	})

	r.POST("/pull", func(c *gin.Context) {
		setCorsHeaders(c)
		auth, err := parseAuthFromHeader(c)
		if err != nil {
			logError(err)
			c.JSON(http.StatusUnauthorized, gin.H{
				"message": "unauthorized",
			})
			return
		}

		var data pullRequest
		if err := c.BindJSON(&data); err != nil {
			log.WithFields(logrus.Fields{
				"err": err,
			}).Error("error")
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "error",
			})
			return
		}
		resp, err := pull(c, db, auth, data)
		if err != nil {
			logError(err)
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
