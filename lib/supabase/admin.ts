import { createClient } from '@supabase/supabase-js'

// Service role client — only for server-side webhook/admin operations
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-project.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
