import type { NextConfig } from "next";

const BACKEND = "https://argus-production-d368.up.railway.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // OAuth 2.1 AS discovery + endpoints — Claude Web calls these directly on the backend.
      // These rewrites let the frontend dev server proxy them too (useful for local testing).
      { source: "/.well-known/:path*",  destination: `${BACKEND}/.well-known/:path*` },
      { source: "/authorize",           destination: `${BACKEND}/authorize` },
      { source: "/register",            destination: `${BACKEND}/register` },
      { source: "/token",               destination: `${BACKEND}/token` },
      // MCP SSE + Bearer endpoints
      { source: "/api/v1/mcp",          destination: `${BACKEND}/api/v1/mcp` },
      { source: "/api/v1/mcp/bearer",   destination: `${BACKEND}/api/v1/mcp/bearer` },
      // Catch-all for any other /api/v1 not handled by a Next.js route file
      { source: "/api/v1/:path*",       destination: `${BACKEND}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
