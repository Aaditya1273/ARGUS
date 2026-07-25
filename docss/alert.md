# Alert List Page

Tags: SigNoz Cloud, Self-Host

Tag definitions:
- SigNoz Cloud: This page applies to SigNoz Cloud editions.
- Self-Host: This page applies to self-hosted SigNoz editions.

The Alerts page in SigNoz has three tabs — **Alert Rules** for managing your configured alert rules, **Triggered Alerts** for seeing which alerts are currently firing, and **Configurations** for routing policies and planned downtime.

## Alert Rules Tab

![A gif explaining the Alerts Rules Tab in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/product-features/alerts/alerts-alert-rules-tab.gif)

*Features of Alert Rules Tab<!-- -->*

The Alert Rules tab provides an overview of all configured alert rules. Here's a breakdown of the features:

### Alert Rule Columns

- **Status**: Indicates whether the alert rule is enabled (OK) or disabled.
- **Alert Name**: The name given to the alert rule for easy identification.
- **Severity**: The level of severity assigned to the alert (e.g., `warning`, `critical`).
- **Labels**: Displays any labels associated with the alert rule.

### Additional Options

- **Filter by Created At, Created By, Updated At, and Updated By**: Customize which fields are displayed using the filter option in the top-right corner.
- **Sorting Columns**: Click a column header to sort the list in ascending or descending order.
- **New Alert**: Click the **+ New Alert** button at the top-right corner to create a new alert rule.

### Navigation and Search

- **Search Bar**: Search for specific alert rules by **name**, **severity**, or **label**.
- **Pagination Controls**: Navigate through multiple pages of alert rules.
- **Actions Menu**: Found on the right side of each row — **Enable**, **Edit**, **Clone**, and **Delete**.

## Triggered Alerts Tab

![A gif explaining the Triggered Alerts Tab in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/product-features/alerts/alerts-triggered-tab.gif)

*Features of Triggered Alerts Tab<!-- -->*

The Triggered Alerts tab shows currently firing alerts in real-time.

### Triggered Alert Columns

- **Status**: Shows whether the alert is currently firing.
- **Alert Name**: The name of the triggered alert.
- **Severity**: The severity of the triggered alert.
- **Tags**: Additional information or tags related to the alert.
- **Firing Since**: The timestamp when the alert started firing.

### Additional Options

- **Filter by Tags**: Narrow down the list based on specific tags (e.g., `severity:warning`).
- **Group by**: Group alerts based on alert name, severity, etc.

## Managing Alerts via the API

You can manage alert rules programmatically using the SigNoz API. Use `GET /api/v1/rules` to retrieve all alert rules and `POST /api/v1/rules` to create a new alert rule. This is useful for transferring alerts between SigNoz instances.

For an infrastructure-as-code approach, you can also use the [Terraform provider](/docs-onboarding/alerts-management/terraform-provider-signoz/?region=in2).

See the [SigNoz API reference](https://signoz.io/api-reference/) for full details.

## Next Steps

### Configurations Tab

- **[Routing Policy](/docs-onboarding/alerts-management/routing-policy/?region=in2)** — Route alerts to specific notification channels based on labels or severity.
- **[Planned Maintenance](/docs-onboarding/alerts-management/planned-maintenance/?region=in2)** — Silence alerts during scheduled maintenance windows.

### Alert Types

- **[Metric-based Alert](/docs-onboarding/alerts-management/metrics-based-alerts/?region=in2)** — Alert on CPU usage, memory, request rates, and other metrics.
- **[Log-based Alert](/docs-onboarding/alerts-management/log-based-alerts/?region=in2)** — Alert on log patterns, keywords, or error messages.
- **[Trace-based Alert](/docs-onboarding/alerts-management/trace-based-alerts/?region=in2)** — Alert on latency, errors, or specific trace events.
- **[Exceptions-based Alert](/docs-onboarding/alerts-management/exceptions-based-alerts/?region=in2)** — Alert on application exceptions.
- **[Anomaly-based Alert](/docs-onboarding/alerts-management/anomaly-based-alerts/?region=in2)** — Alert when metrics deviate from expected patterns.

More docs: /docs/sitemap.md