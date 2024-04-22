-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS days (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  date TEXT NOT NULL,

  coffee_time TEXT,
  coffee_time_tz TEXT,

  dinner_time TEXT,
  dinner_time_tz TEXT,
  dinner_size TEXT CHECK(dinner_size IN ('regular', 'big')),

  wake_up_time TEXT,
  wake_up_time_tz TEXT,
  last_modified_version INTEGER NOT NULL,
  space_id INTEGER NOT NULL,

  deleted_at TEXT,
  FOREIGN KEY (space_id) REFERENCES spaces (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS days_external_id ON days (external_id);
-- TODO: create index on date
CREATE UNIQUE INDEX IF NOT EXISTS days_space_date ON days (space_id, date);

CREATE TABLE IF NOT EXISTS poops (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  day_id INTEGER NOT NULL,

  time TEXT NOT NULL,
  time_tz TEXT NOT NULL,
  time_into_day_minutes INTEGER,

  deleted_at TEXT,
  FOREIGN KEY (day_id) REFERENCES days (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS poops_external_id ON poops (external_id);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_external_id ON users (external_id);

CREATE TABLE IF NOT EXISTS spaces (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS space_user_id ON spaces (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS spaces_external_id ON spaces (external_id);

CREATE TABLE IF NOT EXISTS replicache_client_groups (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  space_id INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (space_id) REFERENCES spaces (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS replicache_client_groups_external_id ON replicache_client_groups (external_id);

CREATE TABLE IF NOT EXISTS replicache_clients (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL,
  replicache_client_group_id INTEGER NOT NULL,
  last_mutation_id INTEGER NOT NULL,
  last_modified_version INTEGER NOT NULL,

  FOREIGN KEY (replicache_client_group_id) REFERENCES replicache_client_groups (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS replicache_clients_external_id ON replicache_clients (external_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS days;
DROP TABLE IF EXISTS poops;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS spaces;
DROP TABLE IF EXISTS replicache_client_groups;
DROP TABLE IF EXISTS replicache_clients;
-- +goose StatementEnd
