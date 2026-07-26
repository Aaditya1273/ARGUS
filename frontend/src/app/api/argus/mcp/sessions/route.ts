import { NextResponse } from 'next/server'

const BACKEND_BASE = 'https://argus-xhgx.onrender.com/api/v1/mcp'

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_BASE}/sessions`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ sessions: [] })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ sessions: [] })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, action } = body

    if (!session_id || !action) {
      return NextResponse.json({ error: 'session_id and action required' }, { status: 400 })
    }

    const endpoint = action === 'approve' 
      ? `${BACKEND_BASE}/sessions/${session_id}/approve`
      : action === 'block'
      ? `${BACKEND_BASE}/sessions/${session_id}/block`
      : action === 'budget'
      ? `${BACKEND_BASE}/sessions/${session_id}/budget`
      : null

    if (!endpoint) {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    const opts: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store' as RequestCache,
    }

    if (action === 'budget' && body.budget) {
      opts.body = JSON.stringify({ budget: body.budget })
    }

    const res = await fetch(endpoint, opts)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'failed to proxy' }, { status: 503 })
  }
}
