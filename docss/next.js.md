# Next.js OpenTelemetry Instrumentation Guide

Tags: SigNoz Cloud, Self-Host

Tag definitions:
- SigNoz Cloud: This page applies to SigNoz Cloud editions.
- Self-Host: This page applies to self-hosted SigNoz editions.

This guide shows you how to instrument your Next.js application with OpenTelemetry and send traces to SigNoz. You will use the `@vercel/otel` package for instrumentation of both server and edge runtime.

**Using self-hosted SigNoz?**

Most steps are identical. To adapt this guide, update the endpoint and remove the ingestion key header as shown in [Cloud to Self-Hosted](/docs-onboarding/ingestion/cloud-vs-self-hosted/#cloud-to-self-hosted?region=in2).

## Prerequisites

- [Node.js 20.6.0+](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md#-nodejs-supported-versions)
- If you're on Node 18, use [18.19.0+](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/upgrade-to-2.x.md#-nodejs-supported-versions). Node 18 reached [end of life on March 27, 2025](https://nodejs.org/en/about/eol).
- [Next.js with App Router or Pages Router](https://nextjs.org/docs)
- A SigNoz Cloud account or self-hosted SigNoz instance

## Send traces to SigNoz

### VM

**What classifies as VM?**

A VM is a virtual computer that runs on physical hardware. This includes:

- **Cloud VMs**: AWS EC2, Google Compute Engine, Azure VMs, DigitalOcean Droplets
- **On-premise VMs**: VMware, VirtualBox, Hyper-V, KVM
- **Bare metal servers**: Physical servers running Linux/Unix directly

Use this section if you're deploying your Next.js application directly on a server or VM without containerization.

### Step 1. Set environment variables

```bash
export OTEL_SERVICE_NAME="<service_name>"
export OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>"
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://ingest.in2.signoz.cloud:443/v1/traces"
export SIGNOZ_INGESTION_KEY="<your-ingestion-key>"
```

Verify these values:

- `<service_name>`: Name of your service (e.g., `nextjs-frontend`).
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).
- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Step 2. Install OpenTelemetry packages

```bash
npm install --save @vercel/otel @opentelemetry/api
```

### Step 3. Update next.config.mjs (Next.js 14 and below only)

**Note**

Skip this step if you are using Next.js 15 or later.

next.config.mjs

```tsx
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
```

### Step 4. Create the instrumentation file

Create `instrumentation.ts` (or `instrumentation.js`) in your project root or inside `src/` if you use that folder structure. Do not place it inside `app/` or `pages/`.

### TypeScript

instrumentation.ts

```ts
import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
}
```

### JavaScript

instrumentation.js

```js
const { registerOTel, OTLPHttpJsonTraceExporter } = require('@vercel/otel');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

exports.register = function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
};
```

### Step 5. Run the application

```bash
npm run dev
```

### Kubernetes

### Direct

**Managing multiple services?**

If you're managing multiple services or want automatic instrumentation injection, consider using the [OTel Operator](#otel-operator) tab instead.

### Step 1. Set environment variables

Add the following environment variables to your Kubernetes deployment manifest:

```yaml
env:
- name: OTEL_SERVICE_NAME
  value: '<service-name>'
- name: OTEL_RESOURCE_ATTRIBUTES
  value: 'service.version=<service-version>'
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: 'https://ingest.in2.signoz.cloud:443/v1/traces'
- name: SIGNOZ_INGESTION_KEY
  value: '<your-ingestion-key>'
```

Verify these values:

- `<service-name>`: Name of your service (e.g., `nextjs-frontend`).
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).
- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Step 2. Install OpenTelemetry packages

```bash
npm install --save @vercel/otel @opentelemetry/api
```

### Step 3. Create the instrumentation file

Create `instrumentation.ts` in your project root:

instrumentation.ts

```ts
import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
}
```

### Step 4. Deploy and run

Deploy your application to Kubernetes. The environment variables will be injected into your container and picked up by the instrumentation file.

### OTel Operator

The [OpenTelemetry Operator](/docs-onboarding/opentelemetry-collection-agents/k8s/otel-operator/overview/?region=in2) auto-injects instrumentation into your Next.js pods without modifying your application image.

### Step 1. Set up the OpenTelemetry Operator

Install the Operator and Collector following the [K8s OTel Operator installation guide](/docs-onboarding/opentelemetry-collection-agents/k8s/otel-operator/install/?region=in2).

### Step 2. Create the Instrumentation resource

Create `instrumentation.yaml` to configure Node.js auto-instrumentation:

instrumentation.yaml

```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: nodejs-instrumentation
spec:
  exporter:
    endpoint: http://otel-collector-collector:4318
  propagators:
    - tracecontext
    - baggage
  nodejs:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
```

Deploy this resource to your cluster.

### Step 3. Add annotations to your deployment

Add these annotations to your pod template's `metadata.annotations`:

```yaml
instrumentation.opentelemetry.io/inject-nodejs: "true"
resource.opentelemetry.io/service.name: "<service-name>"
resource.opentelemetry.io/service.version: "<service-version>"
```

Verify these values:

- `<service-name>`: A descriptive name for your service (e.g., `my-nextjs-app`).
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Windows

### Step 1. Set environment variables

```powershell
$env:OTEL_SERVICE_NAME="<service_name>"
$env:OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>"
$env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://ingest.in2.signoz.cloud:443/v1/traces"
$env:SIGNOZ_INGESTION_KEY="<your-ingestion-key>"
```

Verify these values:

- `<service_name>`: Name of your service (e.g., `nextjs-frontend`).
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).
- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2)
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

### Step 2. Install OpenTelemetry packages

```powershell
npm install --save @vercel/otel @opentelemetry/api
```

### Step 3. Update next.config.mjs (Next.js 14 and below only)

**Note**

Skip this step if you are using Next.js 15 or later.

```tsx
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
```

### Step 4. Create the instrumentation file

Create `instrumentation.ts` (or `instrumentation.js`) in your project root or inside `src/` if you use that folder structure. Do not place it inside `app/` or `pages/`.

### TypeScript

instrumentation.ts

```ts
import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
}
```

### JavaScript

instrumentation.js

```js
const { registerOTel, OTLPHttpJsonTraceExporter } = require('@vercel/otel');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

exports.register = function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
};
```

### Step 5. Run the application

```powershell
npm run dev
```

### Docker

### Step 1. Install OpenTelemetry packages

Add the packages to your `package.json`:

```bash
npm install --save @vercel/otel @opentelemetry/api
```

### Step 2. Create the instrumentation file

Create `instrumentation.ts` in your project root:

instrumentation.ts

```ts
import { registerOTel, OTLPHttpJsonTraceExporter } from '@vercel/otel';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nextjs-app',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'https://ingest.in2.signoz.cloud:443/v1/traces',
      headers: process.env.SIGNOZ_INGESTION_KEY
        ? { 'signoz-ingestion-key': process.env.SIGNOZ_INGESTION_KEY }
        : undefined,
    }),
  });
}
```

### Step 3. Configure your Dockerfile

Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# OpenTelemetry configuration
ENV OTEL_SERVICE_NAME="nextjs-app"
ENV OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>"
ENV OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://ingest.in2.signoz.cloud:443/v1/traces"
ENV SIGNOZ_INGESTION_KEY="<your-ingestion-key>"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

Or pass environment variables at runtime:

```bash
docker run -e OTEL_SERVICE_NAME="nextjs-app" \
  -e OTEL_RESOURCE_ATTRIBUTES="service.version=<service-version>" \
  -e OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://ingest.in2.signoz.cloud:443/v1/traces" \
  -e SIGNOZ_INGESTION_KEY="<your-ingestion-key>" \
  -p 3000:3000 your-nextjs-image:latest
```

Verify these values:

- `in2`: Your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2).
- `<your-ingestion-key>`: Your SigNoz [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2).
- `<service-version>` (optional): Your release version, image tag, or git SHA (e.g., `1.4.2`, `a01dbef8`).

**Recommended: Set service.version for Deployment Markers**

Set `service.version` to a per-build value, not a static string. SigNoz detects a deployment each time this value changes. Common sources:

- **Bash / shell**: `service.version=$(git rev-parse --short HEAD)`
- **GitHub Actions**: `service.version=${{ github.sha }}`
- **GitLab CI**: `service.version=$CI_COMMIT_SHORT_SHA`
- **Kubernetes**: inject from your Helm chart image tag or CI variable

## For Next.js 14 and below

### Why is this required?

In Next.js 14 and earlier versions, the instrumentation feature was experimental and required explicit opt-in through a configuration flag.

### How to enable it

Add the following to your `next.config.mjs`:

next.config.mjs

```tsx
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
}

export default nextConfig
```

### What changed in Next.js 15?

In [Next.js 15](https://nextjs.org/blog/next-15), the `instrumentation.js` API was promoted from experimental to stable. This means:

- The `experimental.instrumentationHook` config option is no longer needed
- You can simply create an `instrumentation.ts` file without any additional configuration
- A new `onRequestError` hook was introduced for better error tracking integration

## Validate

After running your instrumented application, verify traces appear in SigNoz:

1. Generate traffic by making requests to your application.
2. Open SigNoz and navigate to **Services**.
3. Click **Refresh** and look for your service name.
4. Go to **Traces** and filter by your service to inspect spans.

## Troubleshooting

### Traces are not appearing in SigNoz

**Check the instrumentation file location:** The file must be in the project root or `src/` folder, not inside `app/` or `pages/`.

**Enable debug logging:** Change `DiagLogLevel.ERROR` to `DiagLogLevel.DEBUG` in your instrumentation file to see detailed output.

**Verify endpoint connectivity:**

```bash
curl -v https://ingest.in2.signoz.cloud:443/v1/traces
```

### Instrumentation hook not working (Next.js 14 and below)

Make sure `instrumentationHook: true` is set in `next.config.mjs` under `experimental`.

### Edge runtime traces missing

The `@vercel/otel` package supports edge runtime. Ensure your instrumentation file exports a `register` function and that it runs in both Node.js and edge environments.

### Service not appearing in Services tab

- Wait a few minutes for data to propagate
- Make actual requests to your app (not just health checks)
- Verify your ingestion key is correct
- Check that the region in the endpoint matches your SigNoz Cloud region

### CORS errors when sending traces

If you see CORS errors, you may be accidentally trying to send traces from the browser. The `@vercel/otel` instrumentation only runs server-side. For browser-side tracing, see the [frontend monitoring guide](/docs-onboarding/frontend-monitoring/sending-traces-with-opentelemetry/?region=in2).

## Setup OpenTelemetry Collector (Optional)

### What is the OpenTelemetry Collector?

The OTel Collector acts as a middleman between your app and SigNoz. Instead of sending data directly, your application sends everything to the Collector first, which then forwards it along.

### Why use it?

- **Cleaning up data** — Filter out noisy traces you don't care about, or remove sensitive info before it leaves your servers.
- **Keeping your app lightweight** — Let the Collector handle batching, retries, and compression instead of your application code.
- **Adding context automatically** — The Collector can tag your data with useful info like which Kubernetes pod or cloud region it came from.
- **Future flexibility** — Want to send data to multiple backends later? The Collector makes that easy without changing your app.

See [Switch from direct export to Collector](/docs-onboarding/opentelemetry-collection-agents/opentelemetry-collector/switch-to-collector/?region=in2) for step-by-step instructions.

## Sample application

Check out the [Sample Next.js App](https://github.com/SigNoz/sample-nextjs-app) for a complete working example.

## Next steps

- [Instrument the client-side of your Next.js app](/docs-onboarding/frontend-monitoring/sending-traces-with-opentelemetry/?region=in2)
- [Capture frontend metrics, logs, and vitals](/docs-onboarding/frontend-monitoring/?region=in2)
- [Correlate traces with logs](/docs-onboarding/traces-management/guides/correlate-traces-and-logs/?region=in2)
- [Set up alerts for your application](/docs-onboarding/alerts-management/notification-channel/slack/?region=in2)
- For deeper walkthroughs, see our [Next.js OpenTelemetry tutorial](https://signoz.io/blog/opentelemetry-nextjs/) and the guide to [tracking Next.js web vitals](https://signoz.io/blog/opentelemetry-nextjs-web-vitals/) with OpenTelemetry.
