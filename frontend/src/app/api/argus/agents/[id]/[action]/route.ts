import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await params
    const BACKEND_URL = `http://127.0.0.1:8080/api/v1/argus/agents/${id}/${action}`

    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Backend returned an error' }, { status: res.status })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Error proxying agent action to backend:', error)
    return NextResponse.json(
      { error: 'Failed to connect to ARGUS Go backend' },
      { status: 503 }
    )
  }
}
