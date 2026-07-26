import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params
    const BACKEND_URL = `https://argus-production-0c2d.up.railway.app/api/v1/mcp/sessions/${id}/${action}`

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
