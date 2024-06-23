ARG GO_VERSION=1
FROM golang:${GO_VERSION}-bookworm as builder

RUN curl -fsSL \
    https://raw.githubusercontent.com/pressly/goose/master/install.sh |\
    sh -s v3.20.0

ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz /tmp/litestream.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz

WORKDIR /usr/src/app
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN go build -v -o /run-app ./server

FROM debian:bookworm

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/app/migrations /usr/src/migrations
COPY --from=builder /usr/local/bin/goose /usr/local/bin/
COPY --from=builder /usr/src/app/litestream.yml /etc/litestream.yml
COPY --from=builder /usr/local/bin/litestream /usr/local/bin/litestream
COPY --from=builder /run-app /usr/local/bin/
CMD ["litestream", "replicate", "-exec", "run-app"]
