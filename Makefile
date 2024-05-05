.PHONY: migrate-create
migrate-create:
	GOOSE_MIGRATION_DIR=./migrations goose create $(name) sql

.PHONY: migrate-up
migrate-up:
	GOOSE_MIGRATION_DIR=./migrations GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=$(DB_PATH) goose up

.PHONY: generate-db-bindings
generate-db-bindings:
	jet -source=sqlite -dsn="./local.db" -path=./gen

.PHONY: lint
lint:
	golangci-lint run ./server/...
	(cd packages/web && bun run lint)
