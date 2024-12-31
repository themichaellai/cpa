package main

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	_ "github.com/mattn/go-sqlite3"
	"github.com/plaid/go-envvar/envvar"
	"github.com/sirupsen/logrus"
	"golang.org/x/net/http2"
)

type envVars struct {
	DbPath     string `envvar:"DB_PATH"`
	CorsOrigin string `envvar:"CORS_ORIGIN"`
}

var log = logrus.New()

var bearerRegexp = regexp.MustCompile(`^[Bb]earer (.+)$`)

func parseAuthFromHeader(c echo.Context) (string, error) {
	auth := c.Request().Header.Get("Authorization")
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

	e := echo.New()

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{env.CorsOrigin},
		AllowMethods: []string{http.MethodPost, http.MethodOptions},
		AllowHeaders: []string{"*"},
	}))

	// Logging middleware (Echo has its own, but you could wrap logrus as well)
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Health check route
	e.GET("/ping", func(c echo.Context) error {
		err := db.Get(new(int), "select 1")
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "error",
			})
		}
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message": "pong",
		})
	})

	e.OPTIONS("/push", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	e.POST("/push", func(c echo.Context) error {
		auth, err := parseAuthFromHeader(c)
		if err != nil {
			logError(err)
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "unauthorized",
			})
		}

		var data pushRequest
		if err := c.Bind(&data); err != nil {
			log.WithFields(logrus.Fields{"err": err}).Error("error")
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "error",
			})
		}

		resp, err := push(c.Request().Context(), db, auth, data)
		if err != nil {
			logError(err)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "error",
			})
		}
		return c.JSON(http.StatusOK, resp)
	})

	e.OPTIONS("/pull", func(c echo.Context) error {
		return c.NoContent(http.StatusOK)
	})

	e.POST("/pull", func(c echo.Context) error {
		auth, err := parseAuthFromHeader(c)
		if err != nil {
			logError(err)
			return c.JSON(http.StatusUnauthorized, map[string]interface{}{
				"message": "unauthorized",
			})
		}

		var data pullRequest
		if err := c.Bind(&data); err != nil {
			log.WithFields(logrus.Fields{"err": err}).Error("error")
			return c.JSON(http.StatusBadRequest, map[string]interface{}{
				"message": "error",
			})
		}

		resp, err := pull(c.Request().Context(), db, auth, data)
		if err != nil {
			logError(err)
			return c.JSON(http.StatusInternalServerError, map[string]interface{}{
				"message": "error",
			})
		}
		return c.JSON(http.StatusOK, resp)
	})

	// Start server on 0.0.0.0:8080
	return e.StartH2CServer(":8080", &http2.Server{})
}

func main() {
	if err := run(); err != nil {
		panic(err)
	}
}
