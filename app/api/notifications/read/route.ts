import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })
export async function POST(request: Request) {
  try {
    const session = await requireUser()
    const { ids } = schema.parse(await request.json())
    const { error } = await createAdminClient().from('notifications').update({ is_read: true }).eq('user_id', session.user.id).in('id', ids)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error) }
}
