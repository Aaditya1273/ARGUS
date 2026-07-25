package state

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// CommandPayload represents a command sent to a Python Agent
type CommandPayload struct {
	Command string `json:"command"` // KILL, PAUSE, RESUME
}

// AgentClient represents a connected Python SDK agent
type AgentClient struct {
	hub     *AgentHub
	conn    *websocket.Conn
	agentID string
	send    chan []byte
}

// AgentHub maintains connections to Python Agents and allows direct command routing
type AgentHub struct {
	clients    map[string]*AgentClient
	register   chan *AgentClient
	unregister chan *AgentClient
	mu         sync.Mutex
}

var globalAgentHub *AgentHub
var agentHubOnce sync.Once

// GetAgentHub returns the singleton AgentHub
func GetAgentHub() *AgentHub {
	agentHubOnce.Do(func() {
		globalAgentHub = &AgentHub{
			register:   make(chan *AgentClient),
			unregister: make(chan *AgentClient),
			clients:    make(map[string]*AgentClient),
		}
		go globalAgentHub.run()
	})
	return globalAgentHub
}

func (h *AgentHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// If already exists, close old one
			if old, ok := h.clients[client.agentID]; ok {
				close(old.send)
			}
			h.clients[client.agentID] = client
			h.mu.Unlock()
			zap.S().Infof("Agent %s connected to Control Plane", client.agentID)
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.agentID]; ok {
				delete(h.clients, client.agentID)
				close(client.send)
			}
			h.mu.Unlock()
			zap.S().Infof("Agent %s disconnected from Control Plane", client.agentID)
		}
	}
}

// SendCommand pushes a command directly to a specific connected agent
func (h *AgentHub) SendCommand(agentID string, command string) bool {
	payload, err := json.Marshal(CommandPayload{Command: command})
	if err != nil {
		return false
	}

	h.mu.Lock()
	client, ok := h.clients[agentID]
	if !ok {
		h.mu.Unlock()
		return false
	}

	select {
	case client.send <- payload:
		h.mu.Unlock()
		return true
	default:
		close(client.send)
		delete(h.clients, agentID)
		h.mu.Unlock()
		return false
	}
}

// ServeAgentWs handles websocket requests from Python Agents
func ServeAgentWs(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agent_id")
	if agentID == "" {
		http.Error(w, "agent_id query parameter is required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		zap.S().Errorf("Failed to upgrade agent websocket: %v", err)
		return
	}

	hub := GetAgentHub()
	client := &AgentClient{
		hub:     hub,
		conn:    conn,
		agentID: agentID,
		send:    make(chan []byte, 256),
	}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *AgentClient) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(65536)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(60 * time.Second)); return nil })
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *AgentClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
