import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/errors'
import { buildQuote, quoteRequestSchema } from '@/lib/server/quote'

export async function POST(request: Request) {
  try {
    const input = quoteRequestSchema.parse(await request.json())
    return NextResponse.json(await buildQuote(input), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
