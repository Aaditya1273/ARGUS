import { NextResponse } from 'next/server'

const BACKEND_URL = 'http://127.0.0.1:8080/api/v1/argus/mcp/demo'

export async function POST() {
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error starting MCP demo:', error)
    return NextResponse.json(
      { error: 'Failed to connect to ARGUS Go backend' },
      { status: 503 }
    )
  }
}
