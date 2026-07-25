# Go OpenTelemetry Instrumentation Guide

Tags: SigNoz Cloud, Self-Host

Tag definitions:
- SigNoz Cloud: This page applies to SigNoz Cloud editions.
- Self-Host: This page applies to self-hosted SigNoz editions.

This guide shows you how to instrument your Go application with OpenTelemetry and send traces to SigNoz. Instrument your Go services with the OpenTelemetry Go SDK and send traces to SigNoz Cloud or a self-hosted collector.

**Using self-hosted SigNoz?**

Most steps are identical. To adapt this guide, update the endpoint and remove the ingestion key header as shown in [Cloud → Self-Hosted](/docs-onboarding/ingestion/cloud-vs-self-hosted/#cloud-to-self-hosted?region=in2).

## Prerequisites

- [Supported Go version](https://pkg.go.dev/go.opentelemetry.io/otel)
- A SigNoz Cloud account or self-hosted SigNoz instance
- Your application code

## Send traces to SigNoz

### VM

**What classifies as VM?**

A VM is a virtual computer that runs on physical hardware. This includes:

- **Cloud VMs**: AWS EC2, Google Compute Engine, Azure VMs, DigitalOcean Droplets
- **On-premise VMs**: VMware, VirtualBox, Hyper-V, KVM
- **Bare metal servers**: Physical servers running Linux/Unix directly

Use this section if you're deploying your Go application directly on a server or VM without containerization.

### Step 1. Set environment variables

Set the following environment variables to configure the OpenTelemetry exporter:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.in2.signoz.cloud:443"
export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-ingestion-key>"
export OTEL_SERVICE_NAME="<service-name>"
export OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>"
```

Verify these values:

- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2)
- `<service-name>`: A descriptive name for your service (e.g., `payment-service`)
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Kubernetes

### Step 1. Set environment variables

Add these environment variables to your deployment manifest:

```yaml
env:
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: 'https://ingest.in2.signoz.cloud:443'
- name: OTEL_EXPORTER_OTLP_HEADERS
  value: 'signoz-ingestion-key=<your-ingestion-key>'
- name: OTEL_SERVICE_NAME
  value: '<service-name>'
- name: OTEL_RESOURCE_ATTRIBUTES
  value: 'service.version=<service-version>'
```

Verify these values:

- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2)
- `<service-name>`: A descriptive name for your service (e.g., `payment-service`)
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Windows

### Step 1. Set environment variables (PowerShell)

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "https://ingest.in2.signoz.cloud:443"
$env:OTEL_EXPORTER_OTLP_HEADERS = "signoz-ingestion-key=<your-ingestion-key>"
$env:OTEL_SERVICE_NAME = "<service-name>"
$env:OTEL_RESOURCE_ATTRIBUTES = "service.version=<service-version>"
```

Verify these values:

- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2)
- `<service-name>`: A descriptive name for your service
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Docker

### Step 1. Set environment variables in Dockerfile

Add environment variables to your Dockerfile:

Dockerfile

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o main .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .

# Set OpenTelemetry environment variables
ENV OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.in2.signoz.cloud:443"
ENV OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-ingestion-key>"
ENV OTEL_SERVICE_NAME="<service-name>"
ENV OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>"

CMD ["./main"]
```

Or pass them at runtime using `docker run`:

```bash
docker run -e OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.in2.signoz.cloud:443" \
    -e OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-ingestion-key>" \
    -e OTEL_SERVICE_NAME="<service-name>" \
    -e OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>" \
    your-image:latest
```

Verify these values:

- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2)
- `<service-name>`: A descriptive name for your service (e.g., `payment-service`)
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Step 2. Install OpenTelemetry packages

Run the following command in your project directory:

```bash
go get \
  go.opentelemetry.io/otel \
  go.opentelemetry.io/otel/sdk \
  go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp \
  go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
```

### Step 3. Create the tracer initialization

Create a file named `tracing.go` in your project:

tracing.go

```go
package main

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Reads OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS from environment
	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, err
	}

	// Reads OTEL_SERVICE_NAME from environment and adds host/process/OS attributes
	res, err := resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithHost(),
		resource.WithOS(),
		resource.WithProcess(),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// Makes the tracer available to instrumentation libraries
	otel.SetTracerProvider(tp)

	// Propagates trace context across service boundaries using W3C standards
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp.Shutdown, nil
}
```

### Step 4. Instrument your application

Here's a complete example using net/http with automatic instrumentation:

main.go

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize tracer: %v", err)
	}
	defer shutdown(ctx)

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "Hello from instrumented server!")
	})

	// Wrap with otelhttp middleware for automatic instrumentation
	handler := otelhttp.NewHandler(mux, "my-service")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
```

## Library instrumentation

Choose your Go framework or library to add automatic instrumentation without leaving this page. Use the categories below to pick a specific integration.

For framework-specific setups, our guides on [instrumenting a Gin application](https://signoz.io/blog/opentelemetry-gin/) and [gRPC services in Go](https://signoz.io/blog/opentelemetry-grpc-golang/) show the common patterns beyond the base SDK.

### Databases & Caches

### GORM

This guide shows you how to add OpenTelemetry instrumentation to GORM. Complete the core Go instrumentation setup first.

### Install GORM OpenTelemetry plugin

```bash
go get gorm.io/gorm
go get gorm.io/plugin/opentelemetry/tracing
```

### Configure GORM with tracing

```go
import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/plugin/opentelemetry/tracing"
)

func initDB() (*gorm.DB, error) {
	dsn := "host=localhost user=postgres password=secret dbname=myapp port=5432"

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Add OpenTelemetry tracing plugin to instrument all operations
	if err := db.Use(tracing.NewPlugin()); err != nil {
		return nil, err
	}

	return db, nil
}

// Use WithContext to propagate trace context
db.WithContext(ctx).Where("id = ?", userID).First(&user)
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- gorm.io/gorm v1.31.1
- gorm.io/plugin/opentelemetry v0.1.16
```

### database/sql

This guide shows you how to add OpenTelemetry instrumentation to database/sql. Complete the core Go instrumentation setup first.

### Install database/sql instrumentation

```bash
go get go.opentelemetry.io/contrib/instrumentation/database/sql/otelsql
```

### Register instrumented driver

```go
import (
	"context"
	"database/sql"
	_ "github.com/lib/pq"

	"go.opentelemetry.io/contrib/instrumentation/database/sql/otelsql"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

// Open an instrumented database connection
db, err := otelsql.Open("postgres", dsn, otelsql.WithAttributes(
	attribute.String("db.system", "postgresql"),
))

// All operations are automatically traced when using context
rows, err := db.QueryContext(ctx, "SELECT * FROM users WHERE id = $1", userID)
```

### Adding manual child spans

```go
tracer := otel.Tracer("my-service")
ctx, span := tracer.Start(ctx, "fetch-user-details")
defer span.End()

span.SetAttributes(attribute.String("user.id", userID))

rows, err := db.QueryContext(ctx, "SELECT * FROM users WHERE id = $1", userID)
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/database/sql/otelsql v0.63.0
```

### MongoDB

This guide shows you how to add OpenTelemetry instrumentation to MongoDB driver. Complete the core Go instrumentation setup first.

### Install MongoDB instrumentation

```bash
go get go.mongodb.org/mongo-driver/mongo
go get go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo
```

### Instrument MongoDB client

```go
import (
	"context"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"
)

clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")

// Add OpenTelemetry monitor to trace all MongoDB operations
clientOptions.SetMonitor(otelmongo.NewMonitor())

client, err := mongo.Connect(ctx, clientOptions)
if err != nil {
	log.Fatal(err)
}

// All operations are automatically traced
collection := client.Database("mydb").Collection("users")
result, err := collection.FindOne(ctx, bson.M{"email": email})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo v0.63.0
```

### Redis

This guide shows you how to add OpenTelemetry instrumentation to Redis. Complete the core Go instrumentation setup first.

### Install Redis instrumentation

```bash
go get github.com/redis/go-redis/v9
go get go.opentelemetry.io/contrib/instrumentation/github.com/redis/go-redis/v9/otelredis
```

### Instrument Redis client

```go
import (
	"context"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/contrib/instrumentation/github.com/redis/go-redis/v9/otelredis"
	"go.opentelemetry.io/otel/attribute"
)

rdb := redis.NewClient(&redis.Options{
	Addr: "localhost:6379",
})

// Add OpenTelemetry instrumentation to trace all Redis commands
if err := otelredis.InstrumentTracing(rdb,
	otelredis.WithAttributes(
		attribute.String("db.system", "redis"),
	),
); err != nil {
	log.Fatal(err)
}

// All operations are automatically traced
val, err := rdb.Get(ctx, "key").Result()
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/github.com/redis/go-redis/v9/otelredis v0.63.0
```

### Web Frameworks

### net/http

This guide shows you how to add OpenTelemetry instrumentation to net/http (standard library). Complete the core Go instrumentation setup first.

### Install net/http instrumentation

```bash
go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp
```

### Complete example

Full working example using standard net/http:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Extract the span created by otelhttp middleware
		span := trace.SpanFromContext(r.Context())

		// Add custom attributes to the span
		span.SetAttributes(attribute.String("custom.key", "value"))

		fmt.Fprint(w, "Hello net/http with tracing!")
	})

	// Wrap with otelhttp middleware to create spans automatically
	handler := otelhttp.NewHandler(mux, "net-http-server")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
```

### Adding manual spans

Create custom child spans to trace specific operations within your handlers:

```go
mux.HandleFunc("/manual", func(w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelhttp middleware)
	ctx, span := tracer.Start(r.Context(), "custom-operation")
	defer span.End()

	span.SetAttributes(attribute.String("manual.key", "value"))
	span.AddEvent("manual.event")

	// Use ctx for downstream calls to propagate the trace
	fmt.Fprint(w, "Manual tracing!")
})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.63.0
```

### Gin

This guide shows you how to add OpenTelemetry instrumentation to a Gin application. Complete the core Go instrumentation setup first.

### Install Gin instrumentation

```bash
go get github.com/gin-gonic/gin
go get go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin
```

### Complete example

```go
package main

import (
	"context"
	"log"
	"os"
	"os/signal"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	r := gin.Default()

	// Add OpenTelemetry middleware to instrument all routes
	r.Use(otelgin.Middleware("my-gin-service"))

	r.GET("/", func(c *gin.Context) {
		// Extract the span created by otelgin middleware
		ctx := c.Request.Context()
		span := trace.SpanFromContext(ctx)

		span.SetAttributes(attribute.String("custom.key", "value"))
		span.AddEvent("manual.event")

		c.JSON(200, gin.H{"message": "Hello traced Gin!"})
	})

	log.Println("Server starting on :8080")
	log.Fatal(r.Run(":8080"))
}
```

### Adding manual child spans

Create additional spans to trace specific operations within your handlers:

```go
r.GET("/process", func(c *gin.Context) {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelgin middleware)
	ctx, span := tracer.Start(c.Request.Context(), "process-data")
	defer span.End()

	span.SetAttributes(attribute.String("operation", "data-processing"))

	// Use ctx for downstream calls to propagate trace context

	c.JSON(200, gin.H{"status": "processed"})
})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.63.0
```

### Echo

This guide shows you how to add OpenTelemetry instrumentation to an Echo application. Complete the core Go instrumentation setup first.

### Install Echo instrumentation

```bash
go get github.com/labstack/echo/v4
go get go.opentelemetry.io/contrib/instrumentation/github.com/labstack/echo/v4/otelecho
```

### Complete example

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"go.opentelemetry.io/contrib/instrumentation/github.com/labstack/echo/v4/otelecho"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	e := echo.New()

	e.Use(middleware.Recover())

	// Add OpenTelemetry middleware to instrument all routes
	e.Use(otelecho.Middleware("my-echo-service"))

	e.GET("/", func(c echo.Context) error {
		// Extract the span created by otelecho middleware
		span := trace.SpanFromContext(c.Request().Context())

		span.SetAttributes(attribute.String("custom.key", "value"))
		span.AddEvent("manual.event")

		return c.String(http.StatusOK, "Hello traced Echo!")
	})

	log.Println("Server starting on :8080")
	log.Fatal(e.Start(":8080"))
}
```

### Adding manual child spans

Create additional spans to trace specific operations within your handlers:

```go
e.GET("/process", func(c echo.Context) error {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelecho middleware)
	ctx, span := tracer.Start(c.Request().Context(), "process-data")
	defer span.End()

	span.SetAttributes(attribute.String("operation", "data-processing"))

	// Use ctx for downstream calls to propagate trace context

	return c.JSON(http.StatusOK, map[string]string{"status": "processed"})
})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/github.com/labstack/echo/v4/otelecho v0.63.0
```

### Fiber

This guide shows you how to add OpenTelemetry instrumentation to a Fiber application. Complete the core Go instrumentation setup first.

### Install Fiber instrumentation

```bash
go get github.com/gofiber/fiber/v3
go get github.com/gofiber/contrib/v3/otel
```

### Complete example

```go
package main

import (
	"context"
	"log"
	"os"
	"os/signal"

	fiberotel "github.com/gofiber/contrib/v3/otel"
	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	app := fiber.New()

	// Add OpenTelemetry middleware to instrument all routes
	app.Use(fiberotel.Middleware())

	app.Get("/", func(c fiber.Ctx) error {
		// Important: Use Context() for Fiber (fasthttp-based)
		span := trace.SpanFromContext(c.Context())

		span.SetAttributes(attribute.String("custom.key", "value"))
		span.AddEvent("manual.event")

		return c.SendString("Hello traced Fiber!")
	})

	log.Println("Server starting on :8080")
	log.Fatal(app.Listen(":8080"))
}
```

### Adding manual child spans

Create additional spans to trace specific operations within your handlers:

```go
app.Get("/process", func(c fiber.Ctx) error {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelfiber middleware)
	// Important: Use Context() for Fiber (fasthttp-based)
	ctx, span := tracer.Start(c.Context(), "process-data")
	defer span.End()

	span.SetAttributes(attribute.String("operation", "data-processing"))

	// Use ctx for downstream calls to propagate trace context

	return c.JSON(fiber.Map{"status": "processed"})
})
```

```text
Tested with:
- Go 1.25.6
- OpenTelemetry Go SDK v1.40.0
- github.com/gofiber/contrib/v3/otel v1.0.0
```

### Chi

This guide shows you how to add OpenTelemetry instrumentation to a Chi application. Complete the core Go instrumentation setup first.

### Install Chi instrumentation

```bash
go get github.com/go-chi/chi/v5
go get github.com/riandyrn/otelchi
```

### Complete example

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/riandyrn/otelchi"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	r := chi.NewRouter()

	r.Use(middleware.Recoverer)
	r.Use(middleware.Logger)

	// Add OpenTelemetry middleware to instrument all routes
	// WithChiRoutes enables better route matching for span names
	r.Use(otelchi.Middleware("my-chi-service", otelchi.WithChiRoutes(r)))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		// Extract the span created by otelchi middleware
		span := trace.SpanFromContext(r.Context())

		span.SetAttributes(attribute.String("custom.key", "value"))
		span.AddEvent("manual.event")

		w.Write([]byte("Hello traced Chi!"))
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
```

### Adding manual child spans

Create additional spans to trace specific operations within your handlers:

```go
r.Get("/process", func(w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelchi middleware)
	ctx, span := tracer.Start(r.Context(), "process-data")
	defer span.End()

	span.SetAttributes(attribute.String("operation", "data-processing"))

	// Use ctx for downstream calls to propagate trace context

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "processed"}`))
})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- github.com/riandyrn/otelchi v0.12.2
```

### Gorilla Mux

This guide shows you how to add OpenTelemetry instrumentation to a Gorilla Mux application. Complete the core Go instrumentation setup first.

### Install Gorilla instrumentation

```bash
go get github.com/gorilla/mux
go get go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux
```

### Complete example

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"

	"github.com/gorilla/mux"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Use the initTracer function from Step 3 above
func initTracer(ctx context.Context) (func(context.Context) error, error) {
	// Paste the complete initTracer implementation from the core setup section
	return nil, nil  // Placeholder - replace with actual implementation
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	shutdown, err := initTracer(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer shutdown(ctx)

	r := mux.NewRouter()

	// Add OpenTelemetry middleware to instrument all routes
	r.Use(otelmux.Middleware("my-gorilla-service"))

	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Extract the span created by otelmux middleware
		span := trace.SpanFromContext(r.Context())

		span.SetAttributes(attribute.String("custom.key", "value"))
		span.AddEvent("manual.event")

		w.Write([]byte("Hello traced Gorilla!"))
	})

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
```

### Adding manual child spans

Create additional spans to trace specific operations within your handlers:

```go
r.HandleFunc("/process", func(w http.ResponseWriter, r *http.Request) {
	tracer := otel.Tracer("my-service")

	// Create a child span (parent created by otelmux middleware)
	ctx, span := tracer.Start(r.Context(), "process-data")
	defer span.End()

	span.SetAttributes(attribute.String("operation", "data-processing"))

	// Use ctx for downstream calls to propagate trace context

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "processed"}`))
})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/github.com/gorilla/mux/otelmux v0.63.0
```

### gRPC

### gRPC Server

This guide shows you how to add OpenTelemetry instrumentation to a gRPC server. Complete the core Go instrumentation setup first.

### Install gRPC instrumentation

```bash
go get google.golang.org/grpc
go get go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc
```

### Add server interceptors

```go
import (
	"google.golang.org/grpc"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
)

// Create gRPC server with OpenTelemetry instrumentation
s := grpc.NewServer(
	grpc.StatsHandler(otelgrpc.NewServerHandler()),
)

// Register your gRPC services
// pb.RegisterYourServiceServer(s, &yourServer{})

lis, err := net.Listen("tcp", ":50051")
if err != nil {
	log.Fatalf("failed to listen: %v", err)
}
log.Println("gRPC server starting on :50051")
if err := s.Serve(lis); err != nil {
	log.Fatalf("failed to serve: %v", err)
}
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.63.0
- google.golang.org/grpc v1.77.0
```

### gRPC Client

This guide shows you how to add OpenTelemetry instrumentation to a gRPC client. Complete the core Go instrumentation setup first.

### Install gRPC instrumentation

```bash
go get google.golang.org/grpc
go get go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc
```

### Add client interceptors

```go
import (
	"context"
	"google.golang.org/grpc"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
)

// Create gRPC client with OpenTelemetry instrumentation
conn, err := grpc.NewClient(
	"localhost:50051",
	grpc.WithTransportCredentials(insecure.NewCredentials()),
	grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
)
if err != nil {
	log.Fatalf("failed to connect: %v", err)
}
defer conn.Close()

// Create your gRPC client
// client := pb.NewYourServiceClient(conn)

// All RPC calls are automatically traced
// resp, err := client.YourMethod(ctx, &pb.YourRequest{})
```

```text
Tested with:
- Go 1.25.1
- OpenTelemetry Go SDK v1.38.0
- go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.63.0
- google.golang.org/grpc v1.77.0
```

For libraries not listed here, see the [OpenTelemetry registry](https://opentelemetry.io/ecosystem/registry/?component=instrumentation\&language=go) for the full list of Go instrumentation packages.

## Validate

After running your instrumented application, verify traces appear in SigNoz:

1. Generate some traffic by making requests to your application.
2. Open SigNoz and navigate to **Traces**.
3. Click **Refresh** and look for new trace entries from your application.

![Go application traces list in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/instrumentation/golang/trace-list.webp)

*List of traces from your Go application<!-- -->*

4. Click on any trace to view detailed span information and timing.

![Individual trace details in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/instrumentation/golang/trace-individual.webp)

*Detailed view of a single trace with span information<!-- -->*

## Troubleshooting

### Why don't traces appear in SigNoz?

**Check environment variables are set:**

```bash
echo $OTEL_EXPORTER_OTLP_ENDPOINT
echo $OTEL_SERVICE_NAME
```

**Verify network connectivity:**

```bash
# For SigNoz Cloud
curl -v https://ingest.in2.signoz.cloud:443/v1/traces
```

### Why do OTLP exports fail with `connection refused`?

- **VM**: Verify the endpoint URL and that your firewall allows outbound HTTPS
- **Kubernetes**: Ensure the OTel Collector service is running and accessible
- **Self-hosted**: Confirm the collector is listening on the expected port

### Why do spans go missing for specific requests?

Ensure you're using instrumented versions of HTTP clients and database drivers. Check if you have not set a sampling rate type which might affect sending spans or span rate.

## Setup OpenTelemetry Collector (Optional)

### What is the OpenTelemetry Collector?

Think of the OTel Collector as a middleman between your app and SigNoz. Instead of your application sending data directly to SigNoz, it sends everything to the Collector first, which then forwards it along.

### Why use it?

- **Cleaning up data** — Filter out noisy traces you don't care about, or remove sensitive info before it leaves your servers.
- **Keeping your app lightweight** — Let the Collector handle batching, retries, and compression instead of your application code.
- **Adding context automatically** — The Collector can tag your data with useful info like which Kubernetes pod or cloud region it came from.
- **Future flexibility** — Want to send data to multiple backends later? The Collector makes that easy without changing your app.

See [Switch from direct export to Collector](/docs-onboarding/opentelemetry-collection-agents/opentelemetry-collector/switch-to-collector/?region=in2) for step-by-step instructions to convert your setup.

For more details, see [Why use the OpenTelemetry Collector?](/docs-onboarding/opentelemetry-collection-agents/opentelemetry-collector/why-to-use-collector/?region=in2) and the [Collector configuration guide](/docs-onboarding/opentelemetry-collection-agents/opentelemetry-collector/configuration/?region=in2).

## Next steps

- Send logs from your Go application using popular logging libraries: [Logrus](/docs-onboarding/logs-management/send-logs/logrus-to-signoz/?region=in2), [Zap](/docs-onboarding/logs-management/send-logs/zap-to-signoz/?region=in2), or [Zerolog](/docs-onboarding/logs-management/send-logs/zerolog-to-signoz/?region=in2)
- [Correlate traces with logs](/docs-onboarding/traces-management/guides/correlate-traces-and-logs/?region=in2) to accelerate triage across signals
- [Set up alerts](/docs-onboarding/alerts-management/notification-channel/slack/?region=in2) for your Go application
- [Create dashboards](/docs-onboarding/userguide/manage-dashboards/?region=in2) to visualize metrics
- Need to create custom spans or add attributes yourself? Use the [Manual Instrumentation in Go guide](/docs-onboarding/instrumentation/manual-instrumentation/golang/manual-instrumentation/?region=in2) once the base setup is in place.

More docs: /docs/sitemap.md




































































Go
Skip to Main Content
Search packages or symbols


Go.
Why Go

Why Go
Case Studies
Use Cases
Security
Learn
Docs

Docs
Effective Go
Go User Manual
Standard library
Release Notes
API
Packages
Community

Community
Recorded Talks
Meetups 
Conferences 
Go blog
Go project
Get connected






Discover Packages
 
go.opentelemetry.io/otel

Go
otel
package
module


Main
Details
checked Valid go.mod file 
checked Redistributable license 
checked Tagged version 
checked Stable version 
Learn more about best practices
Repository
github.com/open-telemetry/opentelemetry-go
Links
Open Source Insights Logo Open Source Insights

type ErrorHandlerFunc
 README ¶
OpenTelemetry-Go
ci codecov.io PkgGoDev Go Report Card OpenSSF Scorecard OpenSSF Best Practices Fuzzing Status FOSSA Status Slack

OpenTelemetry-Go is the Go implementation of OpenTelemetry. It provides a set of APIs to directly measure performance and behavior of your software and send this data to observability platforms.

Project Status
Signal	Status
Traces	Stable
Metrics	Stable
Logs	Beta^1
Progress and status specific to this repository is tracked in our project boards and milestones.

Project versioning information and stability guarantees can be found in the versioning documentation.

Compatibility
OpenTelemetry-Go ensures compatibility with the current supported versions of the Go language:

Each major Go release is supported until there are two newer major releases. For example, Go 1.5 was supported until the Go 1.7 release, and Go 1.6 was supported until the Go 1.8 release.

For versions of Go that are no longer supported upstream, opentelemetry-go will stop ensuring compatibility with these versions in the following manner:

A minor release of opentelemetry-go will be made to add support for the new supported release of Go.
The following minor release of opentelemetry-go will remove compatibility testing for the oldest (now archived upstream) version of Go. This, and future, releases of opentelemetry-go may include features only supported by the currently supported versions of Go.
Currently, this project supports the following environments.

OS	Go Version	Architecture
Ubuntu	1.26	amd64
Ubuntu	1.25	amd64
Ubuntu	1.26	386
Ubuntu	1.25	386
Ubuntu	1.26	arm64
Ubuntu	1.25	arm64
macOS	1.26	amd64
macOS	1.25	amd64
macOS	1.26	arm64
macOS	1.25	arm64
Windows	1.26	amd64
Windows	1.25	amd64
Windows	1.26	386
Windows	1.25	386
While this project should work for other systems, no compatibility guarantees are made for those systems currently.

Getting Started
You can find a getting started guide on opentelemetry.io.

OpenTelemetry's goal is to provide a single set of APIs to capture distributed traces and metrics from your application and send them to an observability platform. This project allows you to do just that for applications written in Go. There are two steps to this process: instrument your application, and configure an exporter.

Instrumentation
To start capturing distributed traces and metric events from your application it first needs to be instrumented. The easiest way to do this is by using an instrumentation library for your code. Be sure to check out the officially supported instrumentation libraries.

If you need to extend the telemetry an instrumentation library provides or want to build your own instrumentation for your application directly you will need to use the Go otel package. The examples are a good way to see some practical uses of this process.

Export
Now that your application is instrumented to collect telemetry, it needs an export pipeline to send that telemetry to an observability platform.

All officially supported exporters for the OpenTelemetry project are contained in the exporters directory.

Exporter	Logs	Metrics	Traces
OTLP	✓	✓	✓
Prometheus		✓	
stdout	✓	✓	✓
Zipkin			✓
Contributing
See the contributing documentation.

Expand ▾
 Documentation ¶
Overview ¶
Package otel provides global access to the OpenTelemetry API. The subpackages of the otel package provide an implementation of the OpenTelemetry API.

The provided API is used to instrument code and measure data about that code's performance and operation. The measured data, by default, is not processed or transmitted anywhere. An implementation of the OpenTelemetry SDK, like the default SDK implementation (go.opentelemetry.io/otel/sdk), and associated exporters are used to process and transport this data.

To read the getting started guide, see https://opentelemetry.io/docs/languages/go/getting-started/.

To read more about tracing, see go.opentelemetry.io/otel/trace.

To read more about metrics, see go.opentelemetry.io/otel/metric.

To read more about logs, see go.opentelemetry.io/otel/log.

To read more about propagation, see go.opentelemetry.io/otel/propagation and go.opentelemetry.io/otel/baggage.

Index ¶
func GetMeterProvider() metric.MeterProvider
func GetTextMapPropagator() propagation.TextMapPropagator
func GetTracerProvider() trace.TracerProvider
func Handle(err error)
func Meter(name string, opts ...metric.MeterOption) metric.Meter
func SetErrorHandler(h ErrorHandler)
func SetLogger(logger logr.Logger)
func SetMeterProvider(mp metric.MeterProvider)
func SetTextMapPropagator(propagator propagation.TextMapPropagator)
func SetTracerProvider(tp trace.TracerProvider)
func Tracer(name string, opts ...trace.TracerOption) trace.Tracer
func Version() string
type ErrorHandler
func GetErrorHandler() ErrorHandler
type ErrorHandlerFunc
func (f ErrorHandlerFunc) Handle(err error)
Examples ¶
SetLogger
Constants ¶
This section is empty.

Variables ¶
This section is empty.

Functions ¶
func GetMeterProvider ¶
added in v0.14.0
func GetMeterProvider() metric.MeterProvider
GetMeterProvider returns the registered global meter provider.

If no global GetMeterProvider has been registered, a No-op GetMeterProvider implementation is returned. When a global GetMeterProvider is registered for the first time, the returned GetMeterProvider, and all the Meters it has created or will create, are recreated automatically from the new GetMeterProvider.

func GetTextMapPropagator ¶
added in v0.14.0
func GetTextMapPropagator() propagation.TextMapPropagator
GetTextMapPropagator returns the global TextMapPropagator. If none has been set, a No-Op TextMapPropagator is returned.

func GetTracerProvider ¶
added in v0.14.0
func GetTracerProvider() trace.TracerProvider
GetTracerProvider returns the registered global trace provider. If none is registered then an instance of NoopTracerProvider is returned.

Use the trace provider to create a named tracer. E.g.

tracer := otel.GetTracerProvider().Tracer("example.com/foo")
or

tracer := otel.Tracer("example.com/foo")
func Handle ¶
added in v0.14.0
func Handle(err error)
Handle is a convenience function for GetErrorHandler().Handle(err).

func Meter ¶
func Meter(name string, opts ...metric.MeterOption) metric.Meter
Meter returns a Meter from the global MeterProvider. The name must be the name of the library providing instrumentation. This name may be the same as the instrumented code only if that code provides built-in instrumentation. If the name is empty, then an implementation defined default name will be used instead.

If this is called before a global MeterProvider is registered the returned Meter will be a No-op implementation of a Meter. When a global MeterProvider is registered for the first time, the returned Meter, and all the instruments it has created or will create, are recreated automatically from the new MeterProvider.

This is short for GetMeterProvider().Meter(name).

func SetErrorHandler ¶
added in v0.14.0
func SetErrorHandler(h ErrorHandler)
SetErrorHandler sets the global ErrorHandler to h.

The first time this is called all ErrorHandler previously returned from GetErrorHandler will send errors to h instead of the default logging ErrorHandler. Subsequent calls will set the global ErrorHandler, but not delegate errors to h.

func SetLogger ¶
added in v1.3.0
func SetLogger(logger logr.Logger)
SetLogger configures the logger used internally to opentelemetry.

Example ¶
func SetMeterProvider ¶
added in v0.14.0
func SetMeterProvider(mp metric.MeterProvider)
SetMeterProvider registers mp as the global MeterProvider.

func SetTextMapPropagator ¶
added in v0.14.0
func SetTextMapPropagator(propagator propagation.TextMapPropagator)
SetTextMapPropagator sets propagator as the global TextMapPropagator.

func SetTracerProvider ¶
added in v0.14.0
func SetTracerProvider(tp trace.TracerProvider)
SetTracerProvider registers `tp` as the global trace provider.

func Tracer ¶
func Tracer(name string, opts ...trace.TracerOption) trace.Tracer
Tracer creates a named tracer that implements Tracer interface. If the name is an empty string then provider uses default name.

This is short for GetTracerProvider().Tracer(name, opts...)

func Version ¶
added in v0.14.0
func Version() string
Version is the current release version of OpenTelemetry in use.

Types ¶
type ErrorHandler ¶
added in v0.11.0
type ErrorHandler interface {

	// Handle handles any error deemed irremediable by an OpenTelemetry
	// component.
	Handle(error)
}
ErrorHandler handles irremediable events.

func GetErrorHandler ¶
added in v0.14.0
func GetErrorHandler() ErrorHandler
GetErrorHandler returns the global ErrorHandler instance.

The default ErrorHandler instance returned will log all errors to STDERR until an override ErrorHandler is set with SetErrorHandler. All ErrorHandler returned prior to this will automatically forward errors to the set instance instead of logging.

Subsequent calls to SetErrorHandler after the first will not forward errors to the new ErrorHandler for prior returned instances.

type ErrorHandlerFunc ¶
added in v1.0.0
type ErrorHandlerFunc func(error)
ErrorHandlerFunc is a convenience adapter to allow the use of a function as an ErrorHandler.

func (ErrorHandlerFunc) Handle ¶
added in v1.0.0
func (f ErrorHandlerFunc) Handle(err error)
Handle handles the irremediable error by calling the ErrorHandlerFunc itself.

 Source Files ¶
View all Source files
doc.go
error_handler.go
handler.go
internal_logging.go
metric.go
propagation.go
trace.go
version.go
 Directories ¶
Show internal
Expand all
attribute
Package attribute provides key and value attributes.
baggage
Package baggage provides functionality for storing and retrieving baggage items in Go context.
bridge
codes
Package codes defines the canonical error codes used by OpenTelemetry.
example
exporter
exporters
log module
metric module
oteltest module
propagation
Package propagation contains OpenTelemetry context propagators.
schema module
sdk module
semconv
trace module
Why Go
Use Cases
Case Studies
Get Started
Playground
Tour
Stack Overflow
Help
Packages
Standard Library
Sub-repositories
About Go Packages
pkg.go.dev API
About
Download
Blog
Issue Tracker
Release Notes
Brand Guidelines
Code of Conduct
Connect
Twitter
GitHub
Slack
r/golang
Meetup
Golang Weekly
Gopher in flight goggles
Copyright
Terms of Service
Privacy Policy
Report an Issue
System theme
Theme Toggle


Shortcuts Modal

Google logo
go.dev uses cookies from Google to deliver and enhance the quality of its services and to analyze traffic. Learn more.
Okay