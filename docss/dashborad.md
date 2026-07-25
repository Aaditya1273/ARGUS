# Manage Dashboards in SigNoz

Tags: SigNoz Cloud, Self-Host

Tag definitions:
- SigNoz Cloud: This page applies to SigNoz Cloud editions.
- Self-Host: This page applies to self-hosted SigNoz editions.

This section shows how you can create, update, and remove dashboards and panels.

![Dashboards page in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/userguide/manage-dashboards/dashboards-page.webp)

*Dashboards page — browse templates, create new dashboards, or import from JSON.<!-- -->*

From the Dashboards page, you can:

- **Browse dashboard templates** — Select the link at the top to explore [60+ pre-built dashboard templates](/docs-onboarding/dashboards/dashboard-templates/overview/?region=in2) for popular integrations. If a template you need is not available, you can request a new one from the templates page.
- **New Dashboard** — Create a dashboard from scratch by entering a name and selecting **+ New Dashboard**.
- **Import JSON** — Import a dashboard from a JSON file or a Grafana export.
- **View templates** — Quickly jump to the templates library to import a pre-built dashboard.

## Prerequisites

- This section assumes that your application is already instrumented. For details about how you can instrument your application, see the
  <!-- -->
  [Instrument Your Application](/docs-onboarding/instrumentation/?region=in2)
  <!-- -->
  section.
- This section assumes that you are familiar with the basics of monitoring applications.

## Create a Custom Dashboard

1. From the sidebar, choose **Dashboards**.

2. Select the **New Dashboard** button.

3. Select the **Configure** icon, and then enter the following information:

   1. A descriptive name for your new dashboard.
   2. *(Optional)* A brief description of your new dashboard.
   3. *(Optional)* Add one or more tags by typing a tag name and pressing enter.

![Dashboard configuration — set name, description, and tags](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/userguide/manage-dashboards/dashboard-configuration.webp)

*Dashboard configuration — set the name, description, and tags for your dashboard.<!-- -->*

4. Select the **Save** button at the far right.

5. For each panel you wish to add, follow the steps in the [Add a Panel to a Dashboard](#add-a-panel-to-a-dashboard) section below.

6. *(Optional)* You can change the order of your panels by dragging and dropping them.

7. When you've finished, select the **Save Layout** button.

## Dashboard Options Menu

Click the **...** (three-dot) menu at the top of any dashboard to access the following options:

![Dashboard options menu in SigNoz](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/userguide/manage-dashboards/dashboard-options-menu.webp)

*Dashboard options menu — lock, rename, export, and more.<!-- -->*

- **Lock Dashboard** — Prevent accidental edits by locking the dashboard. When locked, panels cannot be added, removed, resized, or rearranged. Unlock the dashboard from the same menu to resume editing.
- **Rename** — Quickly rename the dashboard without opening the full configuration drawer.
- **Full screen** — View the dashboard in full-screen mode for presentations or wall displays.
- **New section** — Add a section to organize panels into logical groups within the dashboard.
- **Export JSON** — Download the dashboard configuration as a JSON file for backup or sharing.
- **Copy as JSON** — Copy the dashboard JSON to your clipboard.
- **Delete dashboard** — Permanently delete the dashboard.

## Update a Custom Dashboard

To update the name, description and tags:

1. Select the **Edit** button at the far right.
2. Make the changes.
3. Select the **Save Layout** button.

To resize a panel:

1. Click the bottom-left corner of the panel you want to resize.
2. Keep your left mouse button pressed and resize the panel.
3. When you've finished, select the **Save Layout** button.

To change the position of a panel:

1. Drag and drop a panel to the new position.
2. When you've finished, select the **Save Layout** button.

## Remove a Custom Dashboard

1. From the sidebar, choose **Dashboard**.
2. Find the dashboard you wish to remove. In the **Action** column, select the **Delete** button.

## Add a Panel to a Dashboard

SigNoz supports seven panel types: Time Series, Number, Table, List, Bar, Pie, and Histogram. To add a panel to a dashboard, follow the steps below:

1. From the sidebar, choose **Dashboards**.
2. Find the dashboard to which you want to add a new panel.
3. Select **Add Panel**.
4. Choose a panel type from the dialog.

![New Panel dialog showing available panel types](https://d3nu8xzr1i9u95.cloudfront.net/web/img/docs/userguide/manage-panels/new-panel-dialog.webp)

*Choose from seven panel types when adding a new panel.<!-- -->*

5. Populate the following fields:

   <!-- -->

   1. **Panel Title**: Enter a descriptive name for your panel.
   2. **Description**: Enter a brief and meaningful description of your new panel.
   3. *(Optional)* **Panel Time Preference**: You can use the the drop-down list to specify the time range for which you want to view data. The time range you specify here overrides the global value.
   4. *(Optional)* **Y Axis Unit**: Specify the unit of measurement for the y-axis.

6. To specify the data displayed on your panel, you can use:

   <!-- -->

   - The query builder. The query builder provides an easy-to-use graphical interface that allows you create custom queries. For instructions, see the [Create a Custom Query](/docs-onboarding/userguide/query-builder-v5/?region=in2) page.
   - The declarative query language based on SQL that ClickHouse supports. For details, see the [SQL Reference](https://clickhouse.com/docs/en/sql-reference/) page of the ClickHouse documentation.
   - PromQL. For details see the [Prometheus Querying Language](https://prometheus.io/docs/prometheus/latest/querying/basics/) page of the Prometheus documentation.

7. *(Optional)* If you're using the query builder, you can also transform your data by adding mathematical functions. For example, you can divide the value that a query returns by a number. The following mathematical functions are supported: *exp*, *log*, *ln*, *exp2*, *log2*, *exp10*, *log10*, *sqrt*, *cbrt*, *erf*, *erfc*, *lgamma*, *tgamma*, *sin*, *cos*, *tan*, *asin*, *acos*, *atan*, *degrees*, *radians.*

8. *(Optional)* The result of the panel query returns a timestamp, float value, and optional set of attributes. The attributes from the response can be used in legend formatting.

9. *(Optional)* You can plot up to ten queries on the same panel. To plot a new query, select the **+ Query** button.

10. When you've finished, select the **Save** button.

Note the following about panels:

- The total number of queries and functions you can plot on a single panel must be less or equal to ten.
- Every time you add or modify a function or formula, you must select the **Stage & Run Query** button. If you do not select this button, the panel will not be updated and your changes will be lost whenever you move to a different tab.
- You can hide or unhide a function or formula by selecting the eye icon at its left and then selecting the **Stage & Run Query** button.
- When you install SigNoz, only the data provided by the Hostmetric receiver is available. To enable more metric receivers, see the [Send Metrics to SigNoz](/docs-onboarding/metrics-management/send-metrics/?region=in2) section.

## Update a Panel

1. From the sidebar, choose **Dashboard**.
2. Find the dashboard in which you created the panel you wish to update, and then select the pencil icon located at the top right corner of your panel.
3. Make the changes.
4. When you've finished, select the **Save** button.

## Next Steps

- [Panel Types](/docs-onboarding/dashboards/panel-types/?region=in2) — Choose the best visualization for your query.
- [Manage Variables](/docs-onboarding/userguide/manage-variables/?region=in2) — Create dynamic variables for your dashboards.
- [Public Sharing](/docs-onboarding/dashboards/public-sharing/?region=in2) — Enable or disable public sharing for your dashboards.

## Get Help

If you need help with the steps in this topic, please reach out to us on<!-- --> [SigNoz Community Slack](https://signoz.io/slack/). If you are a SigNoz Cloud user, please use in product chat support located at the bottom right corner of your SigNoz instance or contact us at<!-- --> [cloud-support@signoz.io](mailto:cloud-support@signoz.io).

More docs: /docs/sitemap.md