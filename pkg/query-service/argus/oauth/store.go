// Package oauth implements the in-memory OAuth 2.1 Authorization Server
// that lets Claude Web (claude.ai) connect to the ARGUS MCP endpoint as a
// real, authenticated remote MCP server.
//
// Flow:
//   GET /mcp (no creds) → 401 with WWW-Authenticate: Bearer resource_metadata=...
//   Claude Web reads /.well-known/oauth-protected-resource
//   Claude Web reads /.well-known/oauth-authorization-server
//   Claude Web POSTs /register  → gets client_id
//   Claude Web redirects user to /authorize?client_id=...&code_challenge=...
//   /authorize → 302 → frontend /connect?request=<id>
//   User approves on /connect → POST /api/v1/argus/oauth/approve → redirects with ?code=...
//   Claude Web POSTs /token with code + PKCE verifier → gets rmt_at_... bearer token
//   Claude Web POSTs /mcp with Authorization: Bearer rmt_at_... → real tool calls
package oauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"sync"
	"time"
)

// prefixes so the /mcp handler can distinguish these from plain session IDs
const (
	AccessTokenPrefix  = "rmt_at_"
	RefreshTokenPrefix = "rmt_rt_"
	CodePrefix         = "rmt_code_"
)

func randomToken(prefix string) string {
	b := make([]byte, 32)
	rand.Read(b)
	return prefix + base64.RawURLEncoding.EncodeToString(b)
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// ─── Client (DCR record) ────────────────────────────────────────────────────

type Client struct {
	ClientID     string
	RedirectURIs []string
	ClientName   string
	CreatedAt    time.Time
}

// ─── Authorization Request (the consent window) ────────────────────────────

type AuthRequest struct {
	RequestID     string
	ClientID      string
	RedirectURI   string
	CodeChallenge string // S256
	Resource      string
	Scope         string
	State         string
	ExpiresAt     time.Time
}

// ─── Authorization Code ────────────────────────────────────────────────────

type AuthCode struct {
	CodeHash      string // sha256 of raw code
	ClientID      string
	RedirectURI   string
	CodeChallenge string
	SessionID     string // the MCP ClientSession ID this grant is for
	BudgetLimit   float64
	Resource      string
	Scope         string
	Used          bool
	ExpiresAt     time.Time
}

// ─── Access Token ──────────────────────────────────────────────────────────

type AccessToken struct {
	ID          string
	AccessHash  string
	SessionID   string // maps to MCPServer ClientSession.ID
	BudgetLimit float64
	ClientID    string
	Resource    string
	ExpiresAt   time.Time
	Revoked     bool
	CreatedAt   time.Time
}

// ─── Store ─────────────────────────────────────────────────────────────────

type Store struct {
	mu       sync.RWMutex
	clients  map[string]*Client      // client_id → Client
	requests map[string]*AuthRequest // request_id → AuthRequest
	codes    map[string]*AuthCode    // code_hash → AuthCode
	tokens   map[string]*AccessToken // access_hash → AccessToken
}

func NewStore() *Store {
	return &Store{
		clients:  make(map[string]*Client),
		requests: make(map[string]*AuthRequest),
		codes:    make(map[string]*AuthCode),
		tokens:   make(map[string]*AccessToken),
	}
}

// ─── Client CRUD ───────────────────────────────────────────────────────────

func (s *Store) CreateClient(redirectURIs []string, clientName string) *Client {
	c := &Client{
		ClientID:     "rmt_client_" + randomToken(""),
		RedirectURIs: redirectURIs,
		ClientName:   clientName,
		CreatedAt:    time.Now(),
	}
	s.mu.Lock()
	s.clients[c.ClientID] = c
	s.mu.Unlock()
	return c
}

func (s *Store) GetClient(id string) *Client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.clients[id]
}

// ─── Auth Request CRUD ─────────────────────────────────────────────────────

func (s *Store) CreateRequest(clientID, redirectURI, challenge, resource, scope, state string) *AuthRequest {
	req := &AuthRequest{
		RequestID:     randomToken(""),
		ClientID:      clientID,
		RedirectURI:   redirectURI,
		CodeChallenge: challenge,
		Resource:      resource,
		Scope:         scope,
		State:         state,
		ExpiresAt:     time.Now().Add(10 * time.Minute),
	}
	s.mu.Lock()
	s.requests[req.RequestID] = req
	s.mu.Unlock()
	return req
}

func (s *Store) GetRequest(id string) *AuthRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r := s.requests[id]
	if r == nil || time.Now().After(r.ExpiresAt) {
		return nil
	}
	return r
}

func (s *Store) DeleteRequest(id string) {
	s.mu.Lock()
	delete(s.requests, id)
	s.mu.Unlock()
}

// ─── Code CRUD ─────────────────────────────────────────────────────────────

// CreateCode mints a raw code, stores only the hash. Returns the raw code.
func (s *Store) CreateCode(clientID, redirectURI, challenge, sessionID, resource, scope string, budget float64) string {
	raw := randomToken(CodePrefix)
	ac := &AuthCode{
		CodeHash:      hashToken(raw),
		ClientID:      clientID,
		RedirectURI:   redirectURI,
		CodeChallenge: challenge,
		SessionID:     sessionID,
		BudgetLimit:   budget,
		Resource:      resource,
		Scope:         scope,
		ExpiresAt:     time.Now().Add(2 * time.Minute),
	}
	s.mu.Lock()
	s.codes[ac.CodeHash] = ac
	s.mu.Unlock()
	return raw
}

func (s *Store) GetCode(raw string) *AuthCode {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c := s.codes[hashToken(raw)]
	if c == nil || time.Now().After(c.ExpiresAt) || c.Used {
		return nil
	}
	return c
}

func (s *Store) ClaimCode(raw string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.codes[hashToken(raw)]
	if c == nil || c.Used || time.Now().After(c.ExpiresAt) {
		return false
	}
	c.Used = true
	return true
}

// ─── Token CRUD ────────────────────────────────────────────────────────────

// CreateAccessToken mints a bearer token for a session. Returns the raw token.
func (s *Store) CreateAccessToken(sessionID, clientID, resource string, budget float64) string {
	raw := randomToken(AccessTokenPrefix)
	t := &AccessToken{
		ID:          randomToken(""),
		AccessHash:  hashToken(raw),
		SessionID:   sessionID,
		BudgetLimit: budget,
		ClientID:    clientID,
		Resource:    resource,
		ExpiresAt:   time.Now().Add(1 * time.Hour),
		CreatedAt:   time.Now(),
	}
	s.mu.Lock()
	s.tokens[t.AccessHash] = t
	s.mu.Unlock()
	return raw
}

// GetByBearerToken resolves a raw bearer token → AccessToken. Nil if expired/revoked.
func (s *Store) GetByBearerToken(raw string) *AccessToken {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t := s.tokens[hashToken(raw)]
	if t == nil || t.Revoked || time.Now().After(t.ExpiresAt) {
		return nil
	}
	return t
}

func (s *Store) RevokeTokensBySession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range s.tokens {
		if t.SessionID == sessionID {
			t.Revoked = true
		}
	}
}
