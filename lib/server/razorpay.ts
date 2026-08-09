import { requireServerEnv } from '@/lib/env'
import { ApiError } from './errors'

export async function createRazorpayRefund(input: { paymentId: string; amountPaise: number; idempotencyKey: string; reason: string }) {
  const keyId = requireServerEnv('RAZORPAY_KEY_ID')
  const secret = requireServerEnv('RAZORPAY_KEY_SECRET')
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'X-Refund-Idempotency': input.idempotencyKey,
    },
    body: JSON.stringify({ amount: input.amountPaise, speed: 'normal', notes: { reason: input.reason.slice(0, 200) } }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await response.json().catch(() => ({})) as { id?: string; status?: string; error?: { description?: string } }
  if (!response.ok || !data.id) {
    throw new ApiError(502, 'The refund could not be started. The cafe has been notified.', 'REFUND_FAILED')
  }
  return { id: data.id, status: data.status || 'pending' }
}
