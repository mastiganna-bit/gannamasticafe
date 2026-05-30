const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 1. Read .env.local to get Supabase URL and Service Role Key
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local!')
  process.exit(1)
}

// 2. Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Connecting to Supabase at:', supabaseUrl)

  const updates = [
    {
      id: '11111111-1111-1111-1111-111111111040',
      name: 'Mix Veggie',
      image_path: '/images/sandwiches/mix-veggie-sandwich.jpg'
    },
    {
      id: '11111111-1111-1111-1111-111111111041',
      name: 'Mix Veggie with Sweet Corn',
      image_path: '/images/sandwiches/mix-veggie-sweetcorn-sandwich.jpg'
    },
    {
      id: '11111111-1111-1111-1111-111111111042',
      name: 'Mix Veggie Paneer',
      image_path: '/images/sandwiches/paneer-veggie-sandwich.jpg'
    }
  ]

  for (const item of updates) {
    console.log(`Updating image path for "${item.name}"...`)
    const { data, error } = await supabase
      .from('menu_items')
      .update({ image_path: item.image_path })
      .eq('id', item.id)
      .select()

    if (error) {
      console.error(`Failed to update ${item.name}:`, error.message)
    } else {
      console.log(`Success! "${item.name}" image path updated to: ${item.image_path}`)
    }
  }

  console.log('All database updates completed successfully!')
}

run().catch(console.error)
