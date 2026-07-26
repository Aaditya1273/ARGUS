import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'https://argus-xhgx.onrender.com/api/v1/argus/governance/rules'

export async function GET() {
  try {
    const res = await fetch(BACKEND_URL, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ rules: [], count: 0 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ rules: [], count: 0 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json(), { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to connect to backend' }, { status: 503 })
  }
}
