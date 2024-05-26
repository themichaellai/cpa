ARG GO_VERSION=1
FROM golang:${GO_VERSION}-bookworm as builder

RUN curl -fsSL \
    https://raw.githubusercontent.com/pressly/goose/master/install.sh |\
    sh -s v3.20.0

WORKDIR /usr/src/app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN go build -v -o /run-app ./server

FROM debian:bookworm

COPY --from=builder /usr/src/app/migrations /usr/src/migrations
COPY --from=builder /usr/local/bin/goose /usr/local/bin/
COPY --from=builder /run-app /usr/local/bin/
CMD ["run-app"]
