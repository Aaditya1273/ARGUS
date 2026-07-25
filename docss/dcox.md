Ingestion Overview for SigNoz Cloud



Info
You don't need ingestion keys for self-hosted/community edition of SigNoz. Ingestion keys are only applicable for cloud account of SigNoz.

Overview
SigNoz is designed with an OpenTelemetry-first approach, natively supporting the OpenTelemetry Protocol. In addition to OpenTelemetry compatibility, SigNoz also provides custom in-house endpoints for enhanced functionality.

Get Started
If you haven't already done so, sign up for a SigNoz Cloud account.
After logging into your SigNoz Cloud account, create an Ingestion Key.

Tip
You can find your Ingestion Endpoint and Ingestion Key in the SigNoz UI under Settings > Ingestion.

Endpoint
How do I find my ingestion URL?
Navigate to Settings > Ingestion to find your Ingestion URL.

Find ingestion URL in SigNoz Cloud Settings
Find Ingestion URL and Ingestion Keys in SigNoz Cloud Settings

SigNoz Cloud is available in multiple regions. Your region determines the endpoints you use for ingestion, API access, and MCP connectivity. The region identifier is shown in the Name column of the table below.

Based on your SigNoz Cloud environment, you must configure your applications to use the relevant endpoint and port from the table below:

Name	Cloud Provider	Cloud Region	Ingestion Endpoint
us	gcp	us-central1	
https://ingest.us.signoz.cloud

eu	gcp	europe-central2	
https://ingest.eu.signoz.cloud

in	gcp	asia-south1	
https://ingest.in.signoz.cloud

in2	gcp	asia-south2	
https://ingest.in2.signoz.cloud

eu2	gcp	europe-west4	
https://ingest.eu2.signoz.cloud

us2	gcp	us-east1	
https://ingest.us2.signoz.cloud

Notes
SigNoz Cloud uses port 443 for both OTLP/HTTP and OTLP/gRPC protocols, consolidating traffic through a single port. This approach diverges from the conventional use of separate ports (4317 for OTLP/gRPC and 4318 for OTLP/HTTP) typically seen in OpenTelemetry documentation.
Language SDK Configuration
Configuration typically involves setting the OTEL_EXPORTER_OTLP_ENDPOINT environment variable. Refer to the SigNoz instrumentation docs for language-specific details.

If you are using the signal agnostic environment variable (OTEL_EXPORTER_OTLP_ENDPOINT), you can simply set OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443 and the exporter should append the appropriate path for the signal type (such as v1/traces or v1/metrics). Similarly, if you are using OTLP/GRPC, setting the variable OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443 (replace with your endpoint from the above table).

OpenTelemetry Collector Configuration
Configure the OpenTelemetry exporter in your collector configuration file to point to the appropriate SigNoz endpoint.

exporters:
  <otlp|otlphttp>:
    endpoint: <endpoint>

Deprecation Notice
The following endpoints are deprecated:

ingest.signoz.io
ingest-in.signoz.io
ingest-eu.signoz.io
Authentication Methods
All endpoints are protected by header based key authentication. The header signoz-ingestion-key must be set to the value of your ingestion key in order to successfully ingest data. Additionally, SigNoz also supports basic authentication which means that the header authorization may also additionally be used to ingest data.

Language SDK Configuration
The mechanism to configure headers will vary, but OpenTelemetry language SDKs generally support setting the OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<key> environment variable. Refer to the SigNoz instrumentation docs for language-specific details.

OpenTelemetry Collector Configuration
Configure the OpenTelemetry exporter in your collector configuration with the appropriate header values.

exporters:
  <otlp|otlphttp>:
    headers:
      signoz-ingestion-key: <key>

Deprecation Notice
The following ways of authentication are deprecated:

Using the signoz-access-token header with the value set to your Ingestion key.
Using the signoz-access-token header with the value set Bearer <key> to your Ingestion key.
Using the signoz-access-token header for basic authentication.
Using the authorization header with the value set Bearer <key> to your Ingestion key.
Important Considerations
Payload Size Limit: In order to send data to SigNoz, your payloads must be smaller than the 16MB maximum payload size. Larger payloads will be rejected with an error status code.

Cross-Origin Resource Sharing (CORS): CORS is enabled on all SigNoz endpoints if you wish to send telemetry from your frontend applications.

Timeouts: Requests generally take longer when payloads are larger or networks are slower. If your application produces large payloads due to high telemetry volume or long export intervals, you may need to increase the default timeout settings to avoid export errors.

Compression: Enable compression while sending OTLP data. SigNoz supports gzip compression on all OTLP endpoints. Note that this compression does not apply to any custom endpoints supported by SigNoz.

Retries: Implement retry mechanisms to handle transient errors and reduce data loss.

Language SDK Configuration
OpenTelemetry SDKs generally support setting the following environment variables (see OpenTelemetry docs for more info):

OTEL_BSP_* for spans
OTEL_METRIC_EXPORT_* for metrics
OTEL_BLRP_* for logs
Increase the default timeout settings using the OTEL_EXPORTER_OTLP_TIMEOUT environment variable. The value should be set in milliseconds. Example: OTEL_EXPORTER_OTLP_TIMEOUT=30000. This sets the timeout to 30 seconds.

Configure compression using the OTEL_EXPORTER_OTLP_COMPRESSION=gzip environment variable.

For retries, configuration methods vary by language and SDK. Some SDKs support environment variables (e.g., Java: OTEL_EXPERIMENTAL_EXPORTER_OTLP_RETRY_ENABLED=true). Programmatic configuration may be necessary in some cases. Refer to your specific SDK's documentation for detailed retry configuration options

OpenTelemetry Collector Configuration
Configure the OpenTelemetry otlpexporter or otlphttpexporter in your collector configuration with the appropriate values. The defaults of these exporters can be found below:


exporters:
  <otlp|otlphttp>:
    ...
    timeout: 5s
    compression: gzip
    retry_on_failure:
      enabled: true
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
    sending_queue:
      enabled: true
      num_consumers: 10
      queue_size: 1000
Last updated: May 27, 2026

Edit on GitHub

















<!-- status autogenerated section -->
# OTLP gRPC Exporter
| Status        |           |
| ------------- |-----------|
| Stability     | [alpha]: profiles   |
|               | [stable]: traces, metrics, logs   |
| Distributions | [core], [contrib], [k8s], [otlp] |
| Issues        | [![Open issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector?query=is%3Aissue%20is%3Aopen%20label%3Aexporter%2Fotlp%20&label=open&color=orange&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector/issues?q=is%3Aopen+is%3Aissue+label%3Aexporter%2Fotlp) [![Closed issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector?query=is%3Aissue%20is%3Aclosed%20label%3Aexporter%2Fotlp%20&label=closed&color=blue&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector/issues?q=is%3Aclosed+is%3Aissue+label%3Aexporter%2Fotlp) |

[alpha]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md#alpha
[stable]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md#stable
[core]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol
[contrib]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
[k8s]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-k8s
[otlp]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-otlp
<!-- end autogenerated section -->

Export data via gRPC using [OTLP](
https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md)
format. By default, this exporter requires TLS and offers queued retry capabilities.

## Getting Started

The following settings are required:

- `endpoint` (no default): host:port to which the exporter is going to send OTLP trace data,
using the gRPC protocol. The valid syntax is described
[here](https://github.com/grpc/grpc/blob/master/doc/naming.md).
If a scheme of `https` is used then client transport security is enabled and overrides the `insecure` setting.
- `tls`: see [TLS Configuration Settings](../../config/configtls/README.md) for the full set of available options.
- `retry_on_failure`:  see [Retry on Failure](../exporterhelper/README.md#retry-on-failure) for the full set of available options.
- `sending_queue`: see [Sending Queue](../exporterhelper/README.md#sending-queue) for the full set of available options.
- `timeout` (default = 5s): Time to wait per individual attempt to send data to a backend.

Example:

```yaml
exporters:
  otlp_grpc:
    endpoint: otelcol2:4317
    tls:
      cert_file: file.cert
      key_file: file.key
  otlp/2:
    endpoint: otelcol2:4317
    tls:
      insecure: true
```

By default, `gzip` compression is enabled. See [compression comparison](../../config/configgrpc/README.md#compression-comparison) for details benchmark information. To disable, configure as follows:

```yaml
exporters:
  otlp_grpc:
    ...
    compression: none
```

## Advanced Configuration

Several helper files are leveraged to provide additional capabilities automatically:

- [gRPC settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configgrpc/README.md)
- [TLS and mTLS settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/config/configtls/README.md)
- [Queuing, batching, retry and timeout settings](https://github.com/open-telemetry/opentelemetry-collector/blob/main/exporter/exporterhelper/README.md)

























<!-- status autogenerated section -->
# OTLP HTTP Exporter
| Status        |           |
| ------------- |-----------|
| Stability     | [alpha]: profiles   |
|               | [stable]: traces, metrics, logs   |
| Distributions | [core], [contrib], [k8s], [otlp] |
| Issues        | [![Open issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector?query=is%3Aissue%20is%3Aopen%20label%3Aexporter%2Fotlphttp%20&label=open&color=orange&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector/issues?q=is%3Aopen+is%3Aissue+label%3Aexporter%2Fotlphttp) [![Closed issues](https://img.shields.io/github/issues-search/open-telemetry/opentelemetry-collector?query=is%3Aissue%20is%3Aclosed%20label%3Aexporter%2Fotlphttp%20&label=closed&color=blue&logo=opentelemetry)](https://github.com/open-telemetry/opentelemetry-collector/issues?q=is%3Aclosed+is%3Aissue+label%3Aexporter%2Fotlphttp) |

[alpha]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md#alpha
[stable]: https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md#stable
[core]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol
[contrib]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
[k8s]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-k8s
[otlp]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-otlp
<!-- end autogenerated section -->

The `otlp_http` exporter sends logs, metrics, profiles and traces via HTTP using [OTLP](
https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md)
format.

The `otlphttp` deprecated alias exists for the component name. It will be removed in a future version.
If you use the deprecated alias `otlphttp` in your configuration, change it to `otlp_http`.

The following settings are required:

- `endpoint` (no default): The target base URL to send data to (e.g.: https://example.com:4318).
  To send each signal a corresponding path will be added to this base URL, i.e. for traces
  "/v1/traces" will appended, for metrics "/v1/metrics" will be appended, for logs
  "/v1/logs" will be appended.

The following settings can be optionally configured:

- `traces_endpoint` (no default): The target URL to send trace data to (e.g.: https://example.com:4318/v1/traces).
   If this setting is present the `endpoint` setting is ignored for traces.
- `metrics_endpoint` (no default): The target URL to send metric data to (e.g.: https://example.com:4318/v1/metrics).
   If this setting is present the `endpoint` setting is ignored for metrics.
- `logs_endpoint` (no default): The target URL to send log data to (e.g.: https://example.com:4318/v1/logs).
- `profiles_endpoint` (no default): The target URL to send profile data to (e.g.: https://example.com:4318/v1development/profiles).
   If this setting is present the `endpoint` setting is ignored for logs.
- `tls`: see [TLS Configuration Settings](../../config/configtls/README.md) for the full set of available options.
- `timeout` (default = 30s): HTTP request time limit. For details see https://golang.org/pkg/net/http/#Client
- `read_buffer_size` (default = 0): ReadBufferSize for HTTP client.
- `write_buffer_size` (default = 512 * 1024): WriteBufferSize for HTTP client.
- `encoding` (default = proto): The encoding to use for the messages (valid options: `proto`, `json`)
- `retry_on_failure`:  see [Retry on Failure](../exporterhelper/README.md#retry-on-failure) for the full set of available options.
- `sending_queue`: see [Sending Queue](../exporterhelper/README.md#sending-queue) for the full set of available options.

Example:

```yaml
exporters:
  otlp_http:
    endpoint: https://example.com:4318
```

By default `gzip` compression is enabled. See [compression comparison](../../config/configgrpc/README.md#compression-comparison) for details benchmark information. To disable, configure as follows:

```yaml
exporters:
  otlp_http:
    ...
    compression: none
```

By default `proto` encoding is used, to change the content encoding of the message configure it as follows:

```yaml
exporters:
  otlp_http:
    ...
    encoding: json
```

The full list of settings exposed for this exporter are documented [here](./config.go)
with detailed sample configurations [here](./testdata/config.yaml).