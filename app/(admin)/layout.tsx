import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin,role')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-cream-200">
      {/* Admin Topbar */}
      <div className="bg-cocoa text-cream border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-serif text-lg text-cream-100">Gannamasti Cafe — Admin</span>
          <Link href="/" className="font-sans text-xs text-cream-100 opacity-60 hover:opacity-100">
            ← View Site
          </Link>
        </div>
      </div>
      <main>{children}</main>
    </div>
  )
}
