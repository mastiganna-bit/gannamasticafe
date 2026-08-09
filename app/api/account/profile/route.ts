import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/server/auth'
import { apiErrorResponse } from '@/lib/server/errors'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({ fullName: z.string().trim().min(2).max(80) })

export async function PATCH(request: Request) {
  try {
    const session = await requireUser()
    const { fullName } = schema.parse(await request.json())
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', session.user.id)
    if (error) throw error
    await admin.auth.admin.updateUserById(session.user.id, { user_metadata: { ...session.user.user_metadata, full_name: fullName } })
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error) }
}
