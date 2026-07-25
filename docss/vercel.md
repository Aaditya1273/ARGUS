# SigNoz for Vercel (Marketplace Integration)

Tags: SigNoz Cloud

Tag definitions:
- SigNoz Cloud: This page applies to SigNoz Cloud editions.

The [SigNoz integration on the Vercel Marketplace](https://vercel.com/marketplace/signoz) lets you forward logs and distributed traces from your Vercel projects to SigNoz with a one-click install — no manual drain configuration or custom headers required.

**Want to configure drains yourself?**

See [Stream Telemetry from Vercel to SigNoz](/docs-onboarding/userguide/vercel-to-signoz/?region=in2) for step-by-step drain setup, including self-hosted SigNoz.

## Overview

The SigNoz + Vercel integration enables:

- **Automatic log collection** via log drains, scoped to the sources and environments you configure
- **Distributed tracing** via Vercel's native trace drain with per-environment sampling rules and optional request path filtering
- **A single pane of glass** for all your observability needs — no more jumping between tools

Under the hood the integration creates two Vercel drains (one for Logs, one for Traces) that push data directly to your SigNoz ingestion endpoint.

## Prerequisites

- A [Vercel Pro or Enterprise](https://vercel.com/docs/plans) account
- An instance of [SigNoz Cloud](https://signoz.io/teams/)

**Using self-hosted SigNoz?**

Most steps are identical. To adapt this guide, update the endpoint and remove the ingestion key header as shown in [Cloud → Self-Hosted](/docs-onboarding/ingestion/cloud-vs-self-hosted/#cloud-to-self-hosted?region=in2).

## Step 1: Open the SigNoz Marketplace Listing

Go to [vercel.com/marketplace/signoz](https://vercel.com/marketplace/signoz) and click **Connect Account**.

![Vercel Marketplace SigNoz listing with Connect Account button highlighted](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/vercel/vercel-marketplace-connect.webp)

*SigNoz listing on the Vercel Marketplace — click Connect Account*

## Step 2: Authorise the Integration

A **Connect SigNoz Account** dialog appears. Fill in the following:

1. **Select a Vercel team** to install the integration to.
2. **Select which projects** the integration will have access to — choose *All Projects* or pick specific projects.
3. Review the required permissions (Read for Team/Projects; Read and Write for Drains, Installation, and Integration Resources).
4. Click **Connect Account**.

![Connect SigNoz Account dialog showing team selector, project scope options, and permission list](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/vercel/vercel-marketplace-connect-account.webp)

*Connect SigNoz Account — select team, projects, and grant permissions*

## Step 3: Configure SigNoz Credentials and Signals

After authorising, Vercel connects to the SigNoz integration configuration page. Enter your SigNoz details and choose which signals to forward:

![SigNoz integration config form showing Ingestion URL, Ingestion Key, Logs toggle with source checkboxes, and sampling rule controls](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/vercel/vercel-marketplace-config.webp)

*SigNoz integration configuration — ingestion URL, key, and signal toggles*

### Ingestion credentials

| Field                    | Value                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **SigNoz Ingestion URL** | The ingestion endpoint for your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2) |
| **Set Ingestion Key**    | Your [ingestion key](/docs-onboarding/ingestion/signoz-cloud/keys/?region=in2) from SigNoz **Settings > Ingestion Settings** |

### Logs

Toggle **Logs** on to enable log forwarding. Then configure:

- **Set Log Sources** — select one or more sources to forward: *Static*, *External*, *Build*, *Edge*, *Lambda*, *Firewall*, *Redirect*.
- **Log Sampling Rules** — define sampling rates per environment (production, preview, development). See [Drop Logs](/docs-onboarding/logs-management/guides/drop-logs/?region=in2) for advanced filtering strategies.

### Traces

Toggle **Traces** on to enable trace forwarding. Then configure:

- **Trace Sampling Rules** — set a sampling rate per environment. See [Drop Spans](/docs-onboarding/traces-management/guides/drop-spans/?region=in2) for advanced filtering strategies.
- **Request Path Filter** *(optional)* — restrict tracing to requests matching a specific path prefix.

### Save

Click **Add Integration**. Vercel creates the log drain and/or trace drain automatically and redirects you to the integration settings page.

## Step 4: Verify the Installation

After saving, Vercel redirects you to the integration settings page where you can confirm:

- The **Permissions** granted to SigNoz.
- Which **projects** SigNoz has access to.

![Vercel integration settings page showing SigNoz permissions and project access](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/vercel/vercel-marketplace-installed.webp)

*SigNoz integration installed — permissions and project access confirmed*

To confirm the drains were created, go to **Team Settings > Drains**. You should see two new drains: one for Logs and one for Traces, both connected to your selected projects.

![Vercel Drains settings page listing signoz-trace-drain and signoz-drain both connected to the signoz-marketplace project](/img/docs/vercel/vercel-marketplace-drains.webp)

*Vercel Team Settings > Drains showing the SigNoz log and trace drains*

## Step 5: Validate Data in SigNoz

Give it a minute for data to flow, then:

- **Logs** — open **Logs Explorer** in SigNoz and look for entries with Vercel-specific attributes such as `source`, `projectName`, and `deploymentId`.
- **Traces** — open **Traces** in SigNoz and look for spans originating from your Vercel projects.

## Troubleshooting

### No data appearing in SigNoz

- **Incorrect Ingestion URL** — confirm the URL matches your [SigNoz Cloud region](/docs-onboarding/ingestion/signoz-cloud/overview/#endpoint?region=in2) exactly.
- **Invalid Ingestion Key** — re-check the key in **Settings > Ingestion Settings** in SigNoz. Ensure there is no leading/trailing whitespace.
- **Drain not active** — in Vercel go to **Team Settings > Drains** and check the drain status. Click a drain to see error details if it shows a warning.
- **Pro/Enterprise plan required** — Vercel drains are only available on paid plans. Verify your plan at **Team Settings > Billing**.

### Integration shows an error after "Add Integration"

- Retry by removing and re-adding the integration from the Vercel Marketplace.
- Double-check that the Ingestion URL does not have a trailing slash or extra path segment.

## Next Steps

- [Set up alerts](/docs-onboarding/userguide/alerts-management/?region=in2) to get notified when your Vercel applications contain errors.
- [Create a dashboard](/docs-onboarding/userguide/manage-dashboards/?region=in2) to visualize telemetry volume, error rates, and latency across your Vercel projects.
- [Vercel AI SDK Observability](/docs-onboarding/vercel-ai-sdk-observability/?region=in2) — instrument AI/LLM calls in your Vercel app with SigNoz.

## Get Help

If you need help with the steps in this topic, please reach out to us on [SigNoz Community Slack](https://signoz.io/slack/). If you are a SigNoz Cloud user, please use in product chat support located at the bottom right corner of your SigNoz instance or contact us at [cloud-support@signoz.io](mailto:cloud-support@signoz.io).

More docs: /docs/sitemap.md