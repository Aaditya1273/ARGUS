// Package mcp implements the Model Context Protocol (MCP) server that lets
// Claude Desktop connect to ARGUS as an MCP tool server. Every tool call is
// intercepted, metered for cost, governed by the ARGUS engine, and streamed
// via WebSocket to the Next.js Control Plane.
//
// Protocol: JSON-RPC 2.0 over HTTP SSE (remote) or stdio (local).
// Spec: https://spec.modelcontextprotocol.io/
package mcp

import "encoding/json"

// ---------- JSON-RPC 2.0 Base ----------

// JSONRPCVersion is the JSON-RPC version used.
const JSONRPCVersion = "2.0"

// Request is a JSON-RPC 2.0 request.
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"` // can be string, number, or null
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Response is a JSON-RPC 2.0 response.
type Response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError is a JSON-RPC 2.0 error object.
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// Standard JSON-RPC error codes.
const (
	ErrCodeParse          = -32700
	ErrCodeInvalidRequest = -32600
	ErrCodeMethodNotFound = -32601
	ErrCodeInvalidParams  = -32602
	ErrCodeInternal       = -32603
)

// NewResponse builds a success response.
func NewResponse(id json.RawMessage, result any) *Response {
	raw, _ := json.Marshal(result)
	return &Response{JSONRPC: JSONRPCVersion, ID: id, Result: raw}
}

// NewErrorResponse builds an error response.
func NewErrorResponse(id json.RawMessage, code int, message string) *Response {
	return &Response{JSONRPC: JSONRPCVersion, ID: id, Error: &RPCError{Code: code, Message: message}}
}

// ---------- MCP Method Constants ----------

const (
	MethodInitialize          = "initialize"
	MethodInitialized         = "notifications/initialized"
	MethodToolsList           = "tools/list"
	MethodToolsCall           = "tools/call"
	MethodResourcesList       = "resources/list"
	MethodResourcesRead       = "resources/read"
	MethodResourcesSubscribe  = "resources/subscribe"
	MethodLoggingLevel        = "logging/setLevel"
	MethodPing                = "ping"
	MethodSetTrace            = "tracing/setTrace"
)

// MCP protocol version.
const ProtocolVersion = "2024-11-05"

// ---------- Initialize ----------

// InitializeRequest is sent by the client on connect.
type InitializeRequest struct {
	ProtocolVersion string         `json:"protocolVersion"`
	Capabilities    ClientCapabilities `json:"capabilities"`
	ClientInfo      Implementation `json:"clientInfo"`
}

// ClientCapabilities describes client capabilities.
type ClientCapabilities struct {
	Roots    *struct{} `json:"roots,omitempty"`
	Sampling *struct{} `json:"sampling,omitempty"`
}

// Implementation identifies the client.
type Implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// InitializeResult is the server response to initialize.
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      Implementation     `json:"serverInfo"`
	Instructions    string             `json:"instructions,omitempty"`
}

// ServerCapabilities describes what the server supports.
type ServerCapabilities struct {
	Tools     *ToolCapabilities     `json:"tools,omitempty"`
	Resources *ResourceCapabilities `json:"resources,omitempty"`
	Logging   *struct{}             `json:"logging,omitempty"`
}

// ToolCapabilities describes tool support.
type ToolCapabilities struct {
	ListChanged bool `json:"listChanged"`
}

// ResourceCapabilities describes resource support.
type ResourceCapabilities struct {
	Subscribe bool `json:"subscribe"`
	ListChanged bool `json:"listChanged"`
}

// ---------- Tools ----------

// Tool is a tool that the MCP server exposes to Claude.
type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

// InputSchema is JSON Schema for tool inputs.
type InputSchema struct {
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties"`
	Required   []string       `json:"required,omitempty"`
}

// ListToolsResult is returned by tools/list.
type ListToolsResult struct {
	Tools []Tool `json:"tools"`
}

// CallToolRequest is sent by the client to call a tool.
type CallToolRequest struct {
	Name      string `json:"name"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

// CallToolResult is returned by tools/call.
type CallToolResult struct {
	Content []ContentItem `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// ContentItem is a piece of content in a tool result.
type ContentItem struct {
	Type string `json:"type"` // "text", "image", "resource"
	Text string `json:"text,omitempty"`
	URI  string `json:"uri,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
}

// NewTextResult creates a text success result.
func NewTextResult(text string) *CallToolResult {
	return &CallToolResult{
		Content: []ContentItem{{Type: "text", Text: text}},
	}
}

// NewErrorResult creates a text error result.
func NewErrorResult(errText string) *CallToolResult {
	return &CallToolResult{
		Content: []ContentItem{{Type: "text", Text: errText}},
		IsError: true,
	}
}

// ---------- Resources ----------

// Resource is a resource exposed by the server.
type Resource struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
}

// ListResourcesResult is returned by resources/list.
type ListResourcesResult struct {
	Resources []Resource `json:"resources"`
}

// ReadResourceRequest is sent by the client.
type ReadResourceRequest struct {
	URI string `json:"uri"`
}

// ReadResourceResult is returned by resources/read.
type ReadResourceResult struct {
	Contents []ResourceContent `json:"contents"`
}

// ResourceContent is the content of a resource.
type ResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType,omitempty"`
	Text     string `json:"text,omitempty"`
	Blob     string `json:"blob,omitempty"`
}
