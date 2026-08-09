import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'REQUEST_FAILED'
  ) {
    super(message)
  }
}
export function apiErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Please check the submitted details.', code: 'INVALID_INPUT', fields: error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }

  console.error('Unhandled API error', error instanceof Error ? error.message : error)
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 })
}
