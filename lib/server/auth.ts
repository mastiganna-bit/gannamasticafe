import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ApiError } from './errors'

export type AuthorizedUser = {
  user: User
  profile: {
    id: string
    full_name: string | null
    phone: string | null
    is_admin: boolean
    role: string | null
  }
}
export async function requireUser(): Promise<AuthorizedUser> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new ApiError(401, 'Please log in to continue.', 'AUTH_REQUIRED')

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name, phone, is_admin, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) throw new ApiError(403, 'Your account profile is incomplete.', 'PROFILE_REQUIRED')
  return { user, profile }
}

export async function requireAdmin(): Promise<AuthorizedUser> {
  const session = await requireUser()
  if (!session.profile.is_admin && session.profile.role !== 'admin') {
    throw new ApiError(403, 'Administrator access required.', 'ADMIN_REQUIRED')
  }
  return session
}

export async function requireApprovedDriver(): Promise<AuthorizedUser & { driver: Record<string, unknown> }> {
  const session = await requireUser()
  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('delivery_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .eq('is_approved', true)
    .single()

  if (!driver) throw new ApiError(403, 'Approved delivery-partner access required.', 'DRIVER_REQUIRED')
  return { ...session, driver }
}
