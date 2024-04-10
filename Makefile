.PHONY: migrate-create
migrate-create:
	GOOSE_MIGRATION_DIR=./migrations goose create $(name) sql

.PHONY: migrate-up
migrate-up:
	GOOSE_MIGRATION_DIR=./migrations GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=$(DB_PATH) goose up

.PHONY: lint
lint:
	golangci-lint run ./server/...
