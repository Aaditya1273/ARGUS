package integrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
)

// SlackNotifier sends alerts to a Slack webhook URL
type SlackNotifier struct {
	WebhookURL string
}

func NewSlackNotifier() *SlackNotifier {
	return &SlackNotifier{
		WebhookURL: os.Getenv("SLACK_WEBHOOK_URL"),
	}
}

// SendAlert pushes an anomaly or governance alert to a Slack channel
func (s *SlackNotifier) SendAlert(title string, message string) error {
	if s.WebhookURL == "" {
		slog.Warn("[Slack Integration] SLACK_WEBHOOK_URL not set. Dropping alert.")
		return nil
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("*ARGUS Alert: %s*\n%s", title, message),
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(s.WebhookURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("slack webhook post failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("slack webhook returned %d", resp.StatusCode)
	}

	return nil
}
