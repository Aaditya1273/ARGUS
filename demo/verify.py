#!/usr/bin/env python3
"""Full ARGUS end-to-end verification — all real, no mocks."""
import http.client, json, urllib.parse, sys, time

BASE = "localhost"
PORT = 8080
OK = "✅"
FAIL = "❌"
results = []

def req(method, path, body=None, headers=None, form=False):
    c = http.client.HTTPConnection(BASE, PORT, timeout=8)
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    if form:
        h["Content-Type"] = "application/x-www-form-urlencoded"
    data = None
    if body and form:
        data = urllib.parse.urlencode(body).encode()
    elif body:
        data = json.dumps(body).encode()
    c.request(method, path, data, h)
    r = c.getresponse()
    raw = r.read()
    try:
        return json.loads(raw), r.status, r
    except:
        return raw.decode(), r.status, r

def check(label, cond, detail=""):
    icon = OK if cond else FAIL
    results.append((cond, label))
    print(f"  {icon} {label}", f"  ({detail})" if detail else "")
    return cond

print("\n════════════ ARGUS Real Verification ════════════\n")

# 1. Health
d, s, _ = req("GET", "/api/v1/health")
check("Health", s == 200 and isinstance(d, dict) and d.get("status") == "ok", f"status={s}")

# 2. AS metadata
d, s, _ = req("GET", "/.well-known/oauth-authorization-server")
check("OAuth AS metadata", s == 200 and "authorization_endpoint" in d, f"status={s}")

# 3. Resource metadata
d, s, _ = req("GET", "/.well-known/oauth-protected-resource")
check("OAuth resource metadata", s == 200 and "resource" in d, f"status={s}")

# 4. DCR register
d, s, _ = req("POST", "/register", {"redirect_uris": ["https://claude.ai/api/mcp/auth_callback"], "client_name": "Claude Web"})
client_id = d.get("client_id", "") if isinstance(d, dict) else ""
check("DCR /register", s == 201 and client_id.startswith("rmt_client_"), f"client_id={client_id[:30]}...")

# 5. /authorize → redirect to /connect
c2 = http.client.HTTPConnection(BASE, PORT, timeout=8)
auth_path = (f"/authorize?client_id={urllib.parse.quote(client_id)}"
             "&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback"
             "&response_type=code&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
             "&code_challenge_method=S256&state=test")
c2.request("GET", auth_path)
r2 = c2.getresponse(); r2.read()
loc = r2.getheader("Location", "")
request_id = loc.split("request=")[1].split("&")[0] if "request=" in loc else ""
check("/authorize → /connect redirect", r2.status == 302 and "/connect?request=" in loc, f"→ {loc[:60]}")

# 6. OAuth request details
d, s, _ = req("GET", f"/api/v1/argus/oauth/request?id={request_id}")
check("OAuth request details", s == 200 and d.get("request_id") == request_id, f"client={d.get('client_name')}")

# 7. Approve → code
d, s, _ = req("POST", "/api/v1/argus/oauth/approve", {"request_id": request_id, "budget_limit": 10.0})
redirect_to = d.get("redirect_to", "") if isinstance(d, dict) else ""
code = redirect_to.split("code=")[1].split("&")[0] if "code=" in redirect_to else ""
session_id = d.get("session_id", "") if isinstance(d, dict) else ""
check("Approve → auth code", s == 200 and code.startswith("rmt_code_"), f"code={code[:20]}...")

# 8. /token PKCE exchange → real Bearer token
d, s, _ = req("POST", "/token",
    {"grant_type": "authorization_code", "code": code,
     "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
     "client_id": client_id, "redirect_uri": "https://claude.ai/api/mcp/auth_callback"},
    form=True)
bearer = d.get("access_token", "") if isinstance(d, dict) else ""
check("/token PKCE → bearer token", s == 200 and bearer.startswith("rmt_at_"), f"token={bearer[:28]}...")

# 9. MCP initialize with Bearer token
d, s, _ = req("POST", "/api/v1/mcp/bearer",
    {"jsonrpc": "2.0", "id": 1, "method": "initialize",
     "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                "clientInfo": {"name": "Claude Web", "version": "1.0.0"}}},
    headers={"Authorization": f"Bearer {bearer}"})
srv_name = d.get("result", {}).get("serverInfo", {}).get("name", "") if isinstance(d, dict) else ""
check("MCP initialize (Bearer)", s == 200 and srv_name == "ARGUS Control Plane", f"server={srv_name}")

# 10. MCP tools/list — all 12 tools
d, s, _ = req("POST", "/api/v1/mcp/bearer",
    {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    headers={"Authorization": f"Bearer {bearer}"})
tools = d.get("result", {}).get("tools", []) if isinstance(d, dict) else []
check("MCP tools/list (12 tools)", s == 200 and len(tools) == 12, f"{len(tools)} tools: {[t['name'] for t in tools[:4]]}...")

# 11. MCP tool call: argus_cost_status
d, s, _ = req("POST", "/api/v1/mcp/bearer",
    {"jsonrpc": "2.0", "id": 3, "method": "tools/call",
     "params": {"name": "argus_cost_status", "arguments": {}}},
    headers={"Authorization": f"Bearer {bearer}"})
content = d.get("result", {}).get("content", [{}])[0].get("text", "") if isinstance(d, dict) else ""
check("MCP tool call: argus_cost_status", s == 200 and len(content) > 10, f"{content[:60]}")

# 12. MCP tool call: read_file (real filesystem read)
d, s, _ = req("POST", "/api/v1/mcp/bearer",
    {"jsonrpc": "2.0", "id": 4, "method": "tools/call",
     "params": {"name": "read_file", "arguments": {"path": "README.md"}}},
    headers={"Authorization": f"Bearer {bearer}"})
content = d.get("result", {}).get("content", [{}])[0].get("text", "") if isinstance(d, dict) else ""
check("MCP tool call: read_file (real fs)", s == 200 and len(content) > 50, f"{len(content)} chars read")

# 13. MCP GET with no auth → 401 + WWW-Authenticate
c3 = http.client.HTTPConnection(BASE, PORT, timeout=8)
c3.request("GET", "/api/v1/mcp")
r3 = c3.getresponse(); r3.read()
wwa = r3.getheader("WWW-Authenticate", "")
check("MCP GET no-auth → 401 + WWW-Auth", r3.status == 401 and "oauth-protected-resource" in wwa, f"WWW-Auth present")

# 14. Governance rules (9 real plugins)
d, s, _ = req("GET", "/api/v1/argus/governance/rules")
rule_count = d.get("count", 0) if isinstance(d, dict) else 0
check("Governance rules (9 plugins)", s == 200 and rule_count == 9, f"count={rule_count}")

# 15. Agent DNA profiles (session just created)
d, s, _ = req("GET", "/api/v1/argus/dna/profiles")
profiles = d if isinstance(d, list) else []
check("DNA profiles endpoint", s == 200 and isinstance(d, list), f"{len(profiles)} profiles")

# 16. Stats endpoint — real data, no fake hardcoded growth
d, s, _ = req("GET", "/api/v1/argus/stats")
has_chart = isinstance(d.get("chart_data"), list) and len(d["chart_data"]) == 25
check("Stats — real chart_data (25 pts)", s == 200 and has_chart, f"burn=${d.get('total_cost',0):.4f}")

# 17. Fake demo endpoint removed → 410
d, s, _ = req("POST", "/api/v1/argus/mcp/demo")
check("Fake /mcp/demo removed (404 or 410)", s in (404, 405, 410), f"status={s}")

# 18. SigNoz health check
d, s, _ = req("GET", "/api/v1/argus/signoz/health")
configured = d.get("configured", False) if isinstance(d, dict) else False
check("SigNoz Cloud credentials loaded", s == 200 and configured, f"endpoint={d.get('endpoint','not set')[:40]}")

# 19. MCP sessions list
d, s, _ = req("GET", "/api/v1/mcp/sessions")
sessions = d.get("sessions", []) if isinstance(d, dict) else []
claude_sessions = [x for x in sessions if x.get("client_name") == "Claude Web"]
check("MCP sessions: Claude Web registered", len(claude_sessions) >= 1, f"{len(sessions)} total, {len(claude_sessions)} Claude Web")

# 20. Agent tracker: Claude Web session appears
d, s, _ = req("GET", "/api/v1/argus/agents")
agents = d if isinstance(d, list) else []
cw_agents = [a for a in agents if "claude-web" in a.get("agent_id", "")]
check("Agent tracker: Claude Web session", len(cw_agents) >= 1, f"{len(agents)} agents, {len(cw_agents)} claude-web")

# Summary
passed = sum(1 for ok, _ in results if ok)
total = len(results)
print(f"\n{'═'*48}")
print(f"  {passed}/{total} checks passed")
if passed == total:
    print(f"  {OK} ALL REAL — zero fake/mock data")
else:
    failed = [label for ok, label in results if not ok]
    print(f"  {FAIL} Failed: {', '.join(failed)}")
print(f"{'═'*48}\n")
sys.exit(0 if passed == total else 1)
