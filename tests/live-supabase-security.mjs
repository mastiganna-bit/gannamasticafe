import fs from 'node:fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (!match) continue
  let value = match[2].trim()
  if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value)
  env[match[1]] = value
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key || !anonKey) throw new Error('Supabase environment is unavailable.')
const response = await fetch(`${url}/rest/v1/`, { headers: { apikey:key,Authorization:`Bearer ${key}`,Accept:'application/openapi+json' } })
if (!response.ok) throw new Error(`OpenAPI request failed with ${response.status}`)
const schema = await response.json()
const definitions = schema.definitions || schema.components?.schemas || {}
const requirements = {
  orders:['order_number','payment_method','payment_status','fulfillment_status','original_total_paise','delivery_otp_hash'],
  order_items:['item_name','cancelled_quantity','addons'],customer_addresses:['house','area','latitude','longitude'],
  store_settings:['opening_time','delivery_radius_km','cod_enabled'],reviews:['rating','comment'],password_reset_challenges:['provider_verification_id'],
}
let missing = 0
for (const [table,columns] of Object.entries(requirements)) {
  const present = new Set(Object.keys(definitions[table]?.properties || {}))
  console.log(`${table}: CURRENT ${[...present].join(',') || 'none'}`)
  if (definitions[table]?.required?.length) console.log(`${table}: REQUIRED ${definitions[table].required.join(',')}`)
  const absent = columns.filter((column)=>!present.has(column))
  console.log(`${table}: ${absent.length ? `MISSING ${absent.join(',')}` : 'READY'}`)
  missing += absent.length
}
if (missing) process.exitCode = 2

const publicMenuResponse = await fetch(`${url}/rest/v1/menu_items?select=id&is_available=eq.true&limit=1`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
})
if (!publicMenuResponse.ok) {
  throw new Error(`Anonymous menu read failed with ${publicMenuResponse.status}: ${await publicMenuResponse.text()}`)
}
const publicMenu = await publicMenuResponse.json()
if (!Array.isArray(publicMenu) || publicMenu.length === 0) throw new Error('Anonymous menu read returned no available items.')
console.log('public_menu: READY')
