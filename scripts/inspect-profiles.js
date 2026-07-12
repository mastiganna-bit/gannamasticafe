const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env')
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found!')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const pivot = trimmed.indexOf('=')
  if (pivot === -1) return
  const key = trimmed.substring(0, pivot).trim()
  const val = trimmed.substring(pivot + 1).trim().replace(/^"|"$/g, '') // remove surrounding quotes
  env[key] = val
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key missing in .env!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('--- FETCHING USERS FROM AUTH.USERS ---')
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Error listing auth users:', usersError)
  } else {
    users.forEach(u => {
      console.log(`User ID: ${u.id} | Email: ${u.email} | Phone: ${u.phone} | Created: ${u.created_at}`)
    })
  }

  console.log('\n--- FETCHING PROFILES ---')
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
  if (profilesError) {
    console.error('Error listing profiles:', profilesError)
  } else {
    profiles.forEach(p => {
      console.log(`Profile ID: ${p.id} | Name: ${p.full_name} | Phone: ${p.phone} | Email: ${p.email}`)
    })
  }

  console.log('\n--- FETCHING ORDERS ---')
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, user_id, customer_name, customer_phone, total_price_paise, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  if (ordersError) {
    console.error('Error listing orders:', ordersError)
  } else {
    orders.forEach(o => {
      console.log(`Order ID: ${o.id} | User ID: ${o.user_id} | Name: ${o.customer_name} | Phone: ${o.customer_phone} | Total: ${o.total_price_paise} paise`)
    })
  }
}

run().catch(console.error)
