FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY . .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o argus-server ./cmd/argus-server

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/argus-server .

EXPOSE 8080

CMD ["./argus-server"]
