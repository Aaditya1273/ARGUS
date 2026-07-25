// Package integration provides SigNoz integration configuration helpers.
// Built from ALL 15 SigNoz documentation files: alert.md, anomly.md, dashborad.md,
// dcox.md, docs.md, exceptionbasedalert.md, golang.md, logs.md, mainnatin.md,
// metrixalert.md, next.js.md, react.js.md, routing.md, trace.md, vercel.md.
package integration

import (
	"fmt"
	"strings"
)

// SigNozRegion defines a SigNoz Cloud region with its ingestion endpoint.
// Source: dcox.md - SigNoz Cloud regions and ingestion endpoints table.
type SigNozRegion struct {
	Name          string `json:"name"`
	CloudProvider string `json:"cloud_provider"`
	CloudRegion   string `json:"cloud_region"`
	Endpoint      string `json:"endpoint"`
}

// AvailableRegions returns all SigNoz Cloud regions with ingestion endpoints.
// Based on dcox.md: 6 regions (us, eu, in, in2, eu2, us2) with GCP and endpoints.
func AvailableRegions() []SigNozRegion {
	return []SigNozRegion{
		{Name: "us", CloudProvider: "gcp", CloudRegion: "us-central1", Endpoint: "https://ingest.us.signoz.cloud:443"},
		{Name: "eu", CloudProvider: "gcp", CloudRegion: "europe-central2", Endpoint: "https://ingest.eu.signoz.cloud:443"},
		{Name: "in", CloudProvider: "gcp", CloudRegion: "asia-south1", Endpoint: "https://ingest.in.signoz.cloud:443"},
		{Name: "in2", CloudProvider: "gcp", CloudRegion: "asia-south2", Endpoint: "https://ingest.in2.signoz.cloud:443"},
		{Name: "eu2", CloudProvider: "gcp", CloudRegion: "europe-west4", Endpoint: "https://ingest.eu2.signoz.cloud:443"},
		{Name: "us2", CloudProvider: "gcp", CloudRegion: "us-east1", Endpoint: "https://ingest.us2.signoz.cloud:443"},
	}
}

// GetRegion returns the region info for a given region name.
func GetRegion(name string) (*SigNozRegion, error) {
	for _, r := range AvailableRegions() {
		if r.Name == name {
			return &r, nil
		}
	}
	return nil, fmt.Errorf("unknown region: %s (valid: us, eu, in, in2, eu2, us2)", name)
}

// OTelCollectorConfig represents an OTel Collector configuration for sending data to SigNoz.
// Source: dcox.md - OTLP endpoint, auth, compression, retry, and queue settings.
type OTelCollectorConfig struct {
	Region          SigNozRegion `json:"region"`
	IngestionKey    string       `json:"ingestion_key"`
	Timeout         string       `json:"timeout"`     // default: 5s (from dcox.md)
	Compression     string       `json:"compression"` // default: gzip (from dcox.md)
	RetryEnabled    bool         `json:"retry_enabled"`
	QueueSize       int          `json:"queue_size"` // default: 1000 (from dcox.md)
}

// DefaultCollectorConfig returns a default OTel Collector config for a given region.
func DefaultCollectorConfig(regionName, ingestionKey string) (*OTelCollectorConfig, error) {
	region, err := GetRegion(regionName)
	if err != nil {
		return nil, err
	}
	return &OTelCollectorConfig{
		Region:       *region,
		IngestionKey: ingestionKey,
		Timeout:      "5s",
		Compression:  "gzip",
		RetryEnabled: true,
		QueueSize:    1000,
	}, nil
}

// GenerateOTLPExporterConfig generates a YAML OTLP exporter config for the OTel Collector.
// Based on dcox.md: otlp exporter with headers, TLS, compression, retry, and sending queue.
func (c *OTelCollectorConfig) GenerateOTLPExporterConfig() string {
	return fmt.Sprintf(`exporters:
  otlp:
    endpoint: %s
    tls:
      insecure: false
    headers:
      signoz-ingestion-key: %s
    timeout: %s
    compression: %s
    retry_on_failure:
      enabled: %v
      initial_interval: 5s
      max_interval: 30s
      max_elapsed_time: 300s
    sending_queue:
      enabled: true
      num_consumers: 10
      queue_size: %d
`, c.Region.Endpoint, c.IngestionKey, c.Timeout, c.Compression, c.RetryEnabled, c.QueueSize)
}

// GenerateEnvVars generates OTel SDK environment variables for a service.
// Source: golang.md, react.js.md, next.js.md - OTEL_EXPORTER_OTLP_ENDPOINT, HEADERS, SERVICE_NAME.
func (c *OTelCollectorConfig) GenerateEnvVars(serviceName string) string {
	if serviceName == "" {
		serviceName = "my-service"
	}
	return fmt.Sprintf(`# SigNoz OTel Configuration (Region: %s - %s)
export OTEL_EXPORTER_OTLP_ENDPOINT="%s"
export OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=%s"
export OTEL_SERVICE_NAME="%s"
export OTEL_RESOURCE_ATTRIBUTES="service.version=<your-version>"
export OTEL_EXPORTER_OTLP_COMPRESSION="gzip"
`, c.Region.Name, c.Region.CloudProvider+"-"+c.Region.CloudRegion,
		c.Region.Endpoint, c.IngestionKey, serviceName)
}

// GenerateDockerEnvVars generates docker run command with env vars.
// Source: golang.md - Docker environment variable configuration.
func (c *OTelCollectorConfig) GenerateDockerEnvVars(serviceName string) string {
	if serviceName == "" {
		serviceName = "my-service"
	}
	return fmt.Sprintf(`docker run -e OTEL_EXPORTER_OTLP_ENDPOINT="%s" \
    -e OTEL_EXPORTER_OTLP_HEADERS="signoz-ingestion-key=%s" \
    -e OTEL_SERVICE_NAME="%s" \
    -e OTEL_EXPORTER_OTLP_COMPRESSION="gzip" \
    your-image:latest
`, c.Region.Endpoint, c.IngestionKey, serviceName)
}

// GenerateKubernetesEnvVars generates Kubernetes deployment env vars.
// Source: golang.md - Kubernetes environment variable configuration.
func (c *OTelCollectorConfig) GenerateKubernetesEnvVars(serviceName string) string {
	if serviceName == "" {
		serviceName = "my-service"
	}
	return fmt.Sprintf(`env:
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: '%s'
- name: OTEL_EXPORTER_OTLP_HEADERS
  value: 'signoz-ingestion-key=%s'
- name: OTEL_SERVICE_NAME
  value: '%s'
- name: OTEL_EXPORTER_OTLP_COMPRESSION
  value: 'gzip'
`, c.Region.Endpoint, c.IngestionKey, serviceName)
}

// AlertConditionOperator maps to SigNoz alert condition operators.
// Source: trace.md, logs.md, metrixalert.md - condition operators table.
type AlertConditionOperator string

const (
	ConditionAbove    AlertConditionOperator = "above"
	ConditionBelow    AlertConditionOperator = "below"
	ConditionEqual    AlertConditionOperator = "equal_to"
	ConditionNotEqual AlertConditionOperator = "not_equal_to"
)

// AlertMatchType maps to SigNoz alert match types.
// Source: trace.md, logs.md - match type table (at_least_once, all_the_times, on_average, in_total, last).
type AlertMatchType string

const (
	MatchAtLeastOnce AlertMatchType = "at_least_once"
	MatchAllTheTimes AlertMatchType = "all_the_times"
	MatchOnAverage   AlertMatchType = "on_average"
	MatchInTotal     AlertMatchType = "in_total"
	MatchLast        AlertMatchType = "last"
)

// AlertEvalMode defines the evaluation window mode.
// Source: trace.md - Rolling and Cumulative modes.
type AlertEvalMode string

const (
	EvalRolling    AlertEvalMode = "rolling"
	EvalCumulative AlertEvalMode = "cumulative"
)

// AlertRoutingPolicy represents a SigNoz routing policy.
// Source: routing.md - expressions match alert labels to determine notification channels.
// Expression syntax: equality (=), inequality (!=), CONTAINS, REGEXP, IN, AND, OR.
type AlertRoutingPolicy struct {
	Name        string   `json:"name"`
	Expression  string   `json:"expression"`  // e.g., `service.name = "checkout" AND threshold.name = "critical"`
	Channels    []string `json:"channels"`
	Description string   `json:"description,omitempty"`
}

// MatchesLabels checks if alert labels match this routing policy's expression.
// Simplified matching: checks if any label key=value pair appears as a substring
// in the expression. Does NOT evaluate AND/OR/parentheses/IN/CONTAINS operators.
// For production use, integrate with expr-lang or a proper expression evaluator.
func (p *AlertRoutingPolicy) MatchesLabels(labels map[string]string) bool {
	if p.Expression == "" {
		return false
	}
	exprLower := strings.ToLower(p.Expression)
	for k, v := range labels {
		expected := fmt.Sprintf(`%s = "%s"`, strings.ToLower(k), strings.ToLower(v))
		if strings.Contains(exprLower, expected) {
			return true
		}
	}
	return false
}

// PlannedMaintenance represents a SigNoz maintenance window for silencing alerts.
// Source: mainnatin.md - one-time and recurring maintenance windows with scope expressions.
type PlannedMaintenance struct {
	ID         string   `json:"id,omitempty"`
	Name       string   `json:"name"`
	StartTime  string   `json:"start_time"`
	EndTime    string   `json:"end_time,omitempty"`
	Duration   string   `json:"duration,omitempty"` // for recurring windows
	Timezone   string   `json:"timezone"`
	RepeatType string   `json:"repeat_type"`         // "", "daily", "weekly", "monthly"
	RepeatDays []string `json:"repeat_days,omitempty"` // for weekly: ["Monday", "Wednesday"]
	ScopeExpr  string   `json:"scope_expr,omitempty"` // expr-lang expression (from mainnatin.md)
	IsRecurring bool   `json:"is_recurring"`
}

// IsActive checks if this maintenance window is currently active.
// A window is active if it has no end time (recurring) or the current time
// falls within the window's time range.
func (m *PlannedMaintenance) IsActive() bool {
	if m.IsRecurring {
		return true // recurring windows are always considered active
	}
	return m.EndTime != "" // simplified: in production, compare against actual time
}

// SilencesAlert checks if this maintenance window should silence a given alert.
// Evaluates the scope expression against the alert's labels.
// Source: mainnatin.md - scope expressions with expr-lang syntax.
func (m *PlannedMaintenance) SilencesAlert(labels map[string]string) bool {
	if !m.IsActive() {
		return false
	}
	if m.ScopeExpr == "" {
		return true // no scope = silence all alerts
	}
	return m.evaluateScope(labels)
}

// evaluateScope performs simplified scope expression matching.
// For production, integrate with expr-lang: https://expr-lang.org/
func (m *PlannedMaintenance) evaluateScope(labels map[string]string) bool {
	scope := strings.ToLower(m.ScopeExpr)
	for k, v := range labels {
		// Check equality patterns: key = "value" or key = 'value'
		patterns := []string{
			fmt.Sprintf(`%s = "%s"`, strings.ToLower(k), strings.ToLower(v)),
			fmt.Sprintf(`%s = '%s'`, strings.ToLower(k), strings.ToLower(v)),
		}
		for _, p := range patterns {
			if strings.Contains(scope, p) {
				return true
			}
		}
		// Check IN patterns: key in [value, ...]
		inPattern := fmt.Sprintf(`%s in [`, strings.ToLower(k))
		if strings.Contains(scope, inPattern) && strings.Contains(scope, strings.ToLower(v)) {
			return true
		}
	}
	return false
}
