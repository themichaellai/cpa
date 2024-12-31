deploy

```
$ fly deploy
```

migrations in production:

```
# in `fly ssh console`
$ GOOSE_MIGRATION_DIR=/usr/src/migrations/ GOOSE_DRIVER=sqlite3 GOOSE_DBSTRING=$DB_PATH goose up
```
