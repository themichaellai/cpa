.PHONY: migrate-create
migrate-create:
	GOOSE_MIGRATION_DIR=./migrations goose create $(name) sql

.PHONY: migrate-up
migrate-up:
	godotenv -f .env.local sh -c 'GOOSE_MIGRATION_DIR=./migrations GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=$$DB_PATH goose up'

.PHONY: generate-db-bindings
generate-db-bindings:
	godotenv -f .env.local sh -c 'jet -source=sqlite -dsn=$$DB_PATH -path=./gen'

.PHONY: lint
lint:
	golangci-lint run ./server/...
	(cd packages/web && bun run lint)

.PHONY: dev-server
dev-server:
	godotenv -f .env.local go run ./server

.PHONY: dev-web
dev-web:
	(cd packages/web && bun run dev)
