package oauth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

// PublicBase returns the canonical public URL of the ARGUS server.
// Set ARGUS_PUBLIC_BASE env var in production (e.g. https://argus.example.com).
// Defaults to http://localhost:8080 for local development.
func PublicBase() string {
	if v := os.Getenv("ARGUS_PUBLIC_BASE"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:8080"
}

// DashboardBase is where the Next.js frontend lives.
func DashboardBase() string {
	if v := os.Getenv("ARGUS_DASHBOARD_BASE"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:3000"
}

func resourceMetadataURL() string {
	return PublicBase() + "/.well-known/oauth-protected-resource"
}

// verifyS256 checks a PKCE S256 code_verifier against a stored challenge.
func verifyS256(verifier, challenge string) bool {
	h := sha256.Sum256([]byte(verifier))
	computed := base64.RawURLEncoding.EncodeToString(h[:])
	return computed == challenge
}

// redirectWithParams appends query params to a redirect URI safely (works for
// custom schemes like cursor:// that url.Parse handles poorly).
func redirectWithParams(base string, params map[string]string) string {
	parts := make([]string, 0, len(params))
	for k, v := range params {
		parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(v))
	}
	sep := "?"
	if strings.Contains(base, "?") {
		sep = "&"
	}
	return base + sep + strings.Join(parts, "&")
}

// RegisterRoutes mounts all OAuth 2.1 AS routes on the provided router.
// Also mounts the consent-approve/deny endpoints on the api subrouter.
func RegisterRoutes(r *mux.Router, api *mux.Router, store *Store, onTokenMinted func(sessionID string, budget float64, clientName string)) {
	// ── Discovery ────────────────────────────────────────────────────────────

	r.HandleFunc("/.well-known/oauth-protected-resource", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]any{
			"resource":               PublicBase() + "/api/v1/mcp",
			"authorization_servers":  []string{PublicBase()},
			"scopes_supported":       []string{"mcp"},
			"bearer_methods_supported": []string{"header"},
		})
	}).Methods("GET", "OPTIONS")

	// fallback path some clients use
	r.HandleFunc("/.well-known/oauth-protected-resource/mcp", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]any{
			"resource":               PublicBase() + "/api/v1/mcp",
			"authorization_servers":  []string{PublicBase()},
			"scopes_supported":       []string{"mcp"},
			"bearer_methods_supported": []string{"header"},
		})
	}).Methods("GET", "OPTIONS")

	r.HandleFunc("/.well-known/oauth-authorization-server", func(w http.ResponseWriter, req *http.Request) {
		base := PublicBase()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]any{
			"issuer":                                base,
			"authorization_endpoint":                base + "/authorize",
			"token_endpoint":                        base + "/token",
			"registration_endpoint":                 base + "/register",
			"scopes_supported":                      []string{"mcp"},
			"response_types_supported":              []string{"code"},
			"grant_types_supported":                 []string{"authorization_code"},
			"token_endpoint_auth_methods_supported": []string{"none"},
			"code_challenge_methods_supported":      []string{"S256"},
			"resource":                              base + "/api/v1/mcp",
			"resource_metadata":                     resourceMetadataURL(),
		})
	}).Methods("GET", "OPTIONS")

	// ── Dynamic Client Registration (RFC 7591) ────────────────────────────────

	r.HandleFunc("/register", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if req.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		var body struct {
			RedirectURIs []string `json:"redirect_uris"`
			ClientName   string   `json:"client_name"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil || len(body.RedirectURIs) == 0 {
			http.Error(w, `{"error":"invalid_client_metadata","error_description":"redirect_uris required"}`, http.StatusBadRequest)
			return
		}

		client := store.CreateClient(body.RedirectURIs, body.ClientName)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"client_id":                  client.ClientID,
			"client_id_issued_at":        client.CreatedAt.Unix(),
			"redirect_uris":              client.RedirectURIs,
			"client_name":                client.ClientName,
			"token_endpoint_auth_method": "none",
			"grant_types":                []string{"authorization_code"},
			"response_types":             []string{"code"},
		})
	}).Methods("POST", "OPTIONS")

	// ── Authorization Endpoint ────────────────────────────────────────────────

	r.HandleFunc("/authorize", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		clientID := q.Get("client_id")
		redirectURI := q.Get("redirect_uri")
		challenge := q.Get("code_challenge")
		method := q.Get("code_challenge_method")
		responseType := q.Get("response_type")
		state := q.Get("state")
		resource := q.Get("resource")
		scope := q.Get("scope")

		// validate client FIRST — never redirect on client validation failure
		client := store.GetClient(clientID)
		if client == nil {
			http.Error(w, "unknown client_id", http.StatusBadRequest)
			return
		}

		// validate redirect_uri is registered
		validRedirect := false
		for _, u := range client.RedirectURIs {
			if u == redirectURI {
				validRedirect = true
				break
			}
		}
		if !validRedirect {
			http.Error(w, "redirect_uri not registered for this client", http.StatusBadRequest)
			return
		}

		failRedirect := func(errCode, desc string) {
			params := map[string]string{"error": errCode, "error_description": desc}
			if state != "" {
				params["state"] = state
			}
			http.Redirect(w, req, redirectWithParams(redirectURI, params), http.StatusFound)
		}

		if responseType != "code" {
			failRedirect("unsupported_response_type", "only response_type=code supported")
			return
		}
		if challenge == "" {
			failRedirect("invalid_request", "code_challenge required (PKCE S256)")
			return
		}
		if method != "S256" {
			failRedirect("invalid_request", "code_challenge_method must be S256")
			return
		}

		authReq := store.CreateRequest(clientID, redirectURI, challenge, resource, scope, state)

		// redirect to the Next.js consent page
		consentURL := fmt.Sprintf("%s/connect?request=%s", DashboardBase(), authReq.RequestID)
		http.Redirect(w, req, consentURL, http.StatusFound)
	}).Methods("GET")

	// ── Token Endpoint ────────────────────────────────────────────────────────

	r.HandleFunc("/token", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")

		if req.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		tokenError := func(errCode, desc string) {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error":             errCode,
				"error_description": desc,
			})
		}

		// parse body — support both form-encoded and JSON (Claude Web sends form)
		var grantType, code, verifier, clientID, redirectURI string
		ct := req.Header.Get("Content-Type")
		if strings.Contains(ct, "application/json") {
			var body map[string]string
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				tokenError("invalid_request", "unreadable body")
				return
			}
			grantType = body["grant_type"]
			code = body["code"]
			verifier = body["code_verifier"]
			clientID = body["client_id"]
			redirectURI = body["redirect_uri"]
		} else {
			req.ParseForm()
			grantType = req.FormValue("grant_type")
			code = req.FormValue("code")
			verifier = req.FormValue("code_verifier")
			clientID = req.FormValue("client_id")
			redirectURI = req.FormValue("redirect_uri")
		}

		if grantType != "authorization_code" {
			tokenError("unsupported_grant_type", "only authorization_code supported")
			return
		}
		if code == "" || verifier == "" || clientID == "" {
			tokenError("invalid_request", "code, code_verifier, and client_id are required")
			return
		}

		// validate client
		client := store.GetClient(clientID)
		if client == nil {
			tokenError("invalid_client", "unknown client_id")
			return
		}

		// validate code
		ac := store.GetCode(code)
		if ac == nil {
			tokenError("invalid_grant", "code is invalid or expired")
			return
		}
		if ac.ClientID != clientID {
			tokenError("invalid_grant", "code was issued to a different client")
			return
		}
		if redirectURI != "" && ac.RedirectURI != redirectURI {
			tokenError("invalid_grant", "redirect_uri does not match")
			return
		}

		// PKCE S256 verification
		if !verifyS256(verifier, ac.CodeChallenge) {
			tokenError("invalid_grant", "PKCE verification failed")
			return
		}

		// claim code (single-use)
		if !store.ClaimCode(code) {
			tokenError("invalid_grant", "code already used")
			return
		}

		// mint access token
		rawToken := store.CreateAccessToken(ac.SessionID, clientID, ac.Resource, ac.BudgetLimit)

		// notify appserver that a real session is now active
		if onTokenMinted != nil {
			onTokenMinted(ac.SessionID, ac.BudgetLimit, client.ClientName)
		}

		json.NewEncoder(w).Encode(map[string]any{
			"access_token": rawToken,
			"token_type":   "bearer",
			"expires_in":   3600,
			"scope":        ac.Scope,
		})
	}).Methods("POST", "OPTIONS")

	// ── Consent API (called by the Next.js /connect page) ────────────────────

	// GET /api/v1/argus/oauth/request?id=... → return request details for the UI
	api.HandleFunc("/argus/oauth/request", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		id := req.URL.Query().Get("id")
		r := store.GetRequest(id)
		if r == nil {
			http.Error(w, `{"error":"request not found or expired"}`, http.StatusNotFound)
			return
		}
		client := store.GetClient(r.ClientID)
		clientName := ""
		if client != nil {
			clientName = client.ClientName
		}
		json.NewEncoder(w).Encode(map[string]any{
			"request_id":  r.RequestID,
			"client_name": clientName,
			"client_id":   r.ClientID,
			"scope":       r.Scope,
			"expires_at":  r.ExpiresAt.Format(time.RFC3339),
		})
	}).Methods("GET", "OPTIONS")

	// POST /api/v1/argus/oauth/approve — user approves, server mints code + redirects
	api.HandleFunc("/argus/oauth/approve", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		var body struct {
			RequestID   string  `json:"request_id"`
			BudgetLimit float64 `json:"budget_limit"`
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil || body.RequestID == "" {
			http.Error(w, `{"error":"request_id required"}`, http.StatusBadRequest)
			return
		}

		r := store.GetRequest(body.RequestID)
		if r == nil {
			http.Error(w, `{"error":"request not found or expired"}`, http.StatusNotFound)
			return
		}

		// default budget $10
		budget := body.BudgetLimit
		if budget <= 0 {
			budget = 10.0
		}

		// session ID = the token that will be used as ClientSession.ID in MCPServer
		sessionID := "claude-web-" + randomToken("")[:12]

		// mint the authorization code
		rawCode := store.CreateCode(
			r.ClientID, r.RedirectURI, r.CodeChallenge,
			sessionID, r.Resource, r.Scope, budget,
		)

		// consume the request (single-use)
		store.DeleteRequest(r.RequestID)

		// build redirect_uri with code (+ state if present)
		params := map[string]string{"code": rawCode}
		if r.State != "" {
			params["state"] = r.State
		}
		redirectTo := redirectWithParams(r.RedirectURI, params)

		json.NewEncoder(w).Encode(map[string]string{
			"redirect_to": redirectTo,
			"session_id":  sessionID,
		})
	}).Methods("POST", "OPTIONS")

	// POST /api/v1/argus/oauth/deny — user denies consent
	api.HandleFunc("/argus/oauth/deny", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body struct {
			RequestID string `json:"request_id"`
		}
		json.NewDecoder(req.Body).Decode(&body)
		r := store.GetRequest(body.RequestID)
		if r == nil {
			json.NewEncoder(w).Encode(map[string]string{"status": "already_expired"})
			return
		}
		redirectTo := redirectWithParams(r.RedirectURI, map[string]string{
			"error":             "access_denied",
			"error_description": "User denied access",
		})
		if r.State != "" {
			redirectTo = redirectWithParams(redirectTo, map[string]string{"state": r.State})
		}
		store.DeleteRequest(body.RequestID)
		json.NewEncoder(w).Encode(map[string]string{"redirect_to": redirectTo})
	}).Methods("POST", "OPTIONS")
}
