package integrations

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
)

// WebhookDispatcher sends generic POST requests for integrations (e.g. PagerDuty, Datadog)
type WebhookDispatcher struct {
	EndpointURL string
}

func NewWebhookDispatcher() *WebhookDispatcher {
	return &WebhookDispatcher{
		EndpointURL: os.Getenv("ARGUS_WEBHOOK_URL"),
	}
}

// Dispatch sends JSON payload
func (w *WebhookDispatcher) Dispatch(payload interface{}) error {
	if w.EndpointURL == "" {
		slog.Warn("[Webhook Integration] ARGUS_WEBHOOK_URL not set. Dropping webhook.")
		return nil
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(w.EndpointURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}
