import { NextResponse } from 'next/server'

// The fake demo loop has been removed. Real sessions come from Claude Web (OAuth 2.1)
// or Claude Desktop (SSE). Connect Claude via the Plugins page.
export async function POST() {
  return NextResponse.json(
    {
      error: 'demo_removed',
      message: 'The simulated demo session has been removed. Connect real Claude via the Plugins page.',
      connect_url: 'http://localhost:3000/plugins',
    },
    { status: 410 }
  )
}
