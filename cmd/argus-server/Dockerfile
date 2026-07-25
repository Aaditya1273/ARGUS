FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
COPY pkg/ pkg/
COPY cmd/argus-server/ cmd/argus-server/
RUN go build -o /argus-server ./cmd/argus-server/

FROM alpine:3.20.3
RUN apk add --no-cache ca-certificates
COPY --from=build /argus-server /argus-server
EXPOSE 8080
ENTRYPOINT ["/argus-server"]
