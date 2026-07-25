import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params
    const BACKEND_URL = `http://127.0.0.1:8080/api/v1/mcp/sessions/${id}/${action}`

    const body = await request.text()
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body || '{}',
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to proxy to backend' }, { status: 503 })
  }
}
