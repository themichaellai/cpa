-- +goose Up
-- +goose StatementBegin
ALTER TABLE days ADD COLUMN comment TEXT;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE days DROP COLUMN comment;
-- +goose StatementEnd
