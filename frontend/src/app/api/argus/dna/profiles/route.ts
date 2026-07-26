import { NextResponse } from 'next/server'

const BACKEND_URL = 'https://argus-production-0c2d.up.railway.app/api/v1/argus/dna/profiles'

export async function GET() {
  try {
    const res = await fetch(BACKEND_URL, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json([], { status: 200 }) // return empty array, not error
    }
    const data = await res.json()
    // backend returns array directly
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json([]) // graceful empty on backend down
  }
}
