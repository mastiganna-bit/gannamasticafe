export function requireServerEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.startsWith('dummy-') || value === 'build-placeholder') {
    throw new Error(`Missing required server environment variable: ${name}`)
  }
  return value
}

export function requirePublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
  const value = values[name]
  if (!value) throw new Error(`Missing required public environment variable: ${name}`)
  return value
}
