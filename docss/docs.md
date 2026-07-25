Step 2: Update OpenTelemetry Configuration
Set the following environment variables for your application:

# Replace with your SigNoz cloud region
export OTEL_EXPORTER_OTLP_ENDPOINT="https://ingest.in2.signoz.cloud:443"

# Replace with your SigNoz ingestion key
export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=<your-ingestion-key>"
If you are defining the OTLP configuration directly in your code (instead of using environment variables), update the OTLP exporter settings:

Endpoint: https://ingest.in2.signoz.cloud:443
Headers: Set signoz-ingestion-key to <your-ingestion-key>
Note: The exact syntax depends on the language SDK. Check the SigNoz Instrumentation docs for examples.

If you are using an OpenTelemetry Collector, update your exporter configuration:

exporters:
  otlp:
    endpoint: ingest.in2.signoz.cloud:443
    headers:
      signoz-ingestion-key: <your-ingestion-key>
    tls:
      insecure: false
Verify these values:

in2: Your SigNoz Cloud region
<your-ingestion-key>: Your SigNoz ingestion key

Tip
We also recommend configuring the Resource Detection Processor to automatically detect resource attributes from the host environment.

Validate
Restart your application (and Collector if applicable) with the new configuration.
Generate test data by using your application.
Access SigNoz Dashboard:
Cloud: SigNoz Cloud login
Self-Hosted: http://your-signoz-host:3301
Verify data flow:
Check Traces, Metrics, Logs in SigNoz.
Troubleshooting
Data not appearing?
Check connectivity: Ensure your application can reach the SigNoz OTLP endpoint.
Verify configuration: Double-check endpoint URLs and Ingestion Keys (for Cloud).
Review logs: Check application logs for OTel export errors.
