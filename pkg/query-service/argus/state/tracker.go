package state

import (
	"sync"
	"time"
)

type AgentStatus string

const (
	StatusRunning AgentStatus = "RUNNING"
	StatusPaused  AgentStatus = "PAUSED"
	StatusBlocked AgentStatus = "BLOCKED"
	StatusDead    AgentStatus = "DEAD"
)

type AgentState struct {
	AgentID       string      `json:"agent_id"`
	Status        AgentStatus `json:"status"`
	CurrentCost   float64     `json:"current_cost"`
	CurrentTokens int         `json:"current_tokens"`
	LatencyMs     int64       `json:"latency_ms"`
	LastTool      string      `json:"last_tool"`
	StartedAt     time.Time   `json:"started_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

type AgentTracker struct {
	mu     sync.RWMutex
	agents map[string]*AgentState
	hub    *Hub
}

var globalTracker *AgentTracker
var once sync.Once

// GetTracker returns the global singleton instance of the AgentTracker
func GetTracker(hub *Hub) *AgentTracker {
	once.Do(func() {
		globalTracker = &AgentTracker{
			agents: make(map[string]*AgentState),
			hub:    hub,
		}
	})
	// If hub is provided later, update it
	if hub != nil && globalTracker.hub == nil {
		globalTracker.hub = hub
	}
	return globalTracker
}

// UpsertAgent updates or inserts an agent state
func (t *AgentTracker) UpsertAgent(state *AgentState) {
	t.mu.Lock()
	defer t.mu.Unlock()

	state.UpdatedAt = time.Now()
	if _, exists := t.agents[state.AgentID]; !exists {
		if state.StartedAt.IsZero() {
			state.StartedAt = time.Now()
		}
	} else {
		// Preserve start time if updating
		state.StartedAt = t.agents[state.AgentID].StartedAt
	}

	t.agents[state.AgentID] = state
	t.broadcast()
}

// UpdateStatus changes an agent's status
func (t *AgentTracker) UpdateStatus(agentID string, status AgentStatus) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if agent, exists := t.agents[agentID]; exists {
		agent.Status = status
		agent.UpdatedAt = time.Now()
		t.broadcast()
		return nil
	}
	return nil
}

// GetAgent returns a copy of a single agent's state
func (t *AgentTracker) GetAgent(agentID string) (*AgentState, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	if agent, exists := t.agents[agentID]; exists {
		// Return copy to prevent external mutation
		copy := *agent
		return &copy, true
	}
	return nil, false
}

// GetAllAgents returns copies of all agent states
func (t *AgentTracker) GetAllAgents() []AgentState {
	t.mu.RLock()
	defer t.mu.RUnlock()

	var result []AgentState
	for _, agent := range t.agents {
		result = append(result, *agent)
	}
	return result
}

// broadcast sends the latest state to the websocket hub
func (t *AgentTracker) broadcast() {
	if t.hub != nil {
		// We use a non-blocking send or let the hub handle it async
		go func() {
			t.hub.BroadcastMessage(map[string]interface{}{
				"type":   "AGENTS_UPDATE",
				"agents": t.GetAllAgents(),
			})
		}()
	}
}
