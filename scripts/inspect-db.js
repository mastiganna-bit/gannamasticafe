const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found!')
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
  const val = trimmed.substring(pivot + 1).trim()
  env[key] = val
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Querying Refresher & Hot Brews items from Supabase...')
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_item_sizes(*)')
    .eq('category', 'Refresher & Hot Brews')

  if (error) {
    console.error('Database query error:', error.message)
    return
  }

  console.log('Database Items Found:', JSON.stringify(data, null, 2))
}

run().catch(console.error)
