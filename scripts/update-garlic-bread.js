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

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Connecting to Supabase at:', supabaseUrl)
  console.log('Updating garlic bread size labels to "Half" and "Full"...')

  const items = [
    '11111111-1111-1111-1111-111111111064', // Cheese Garlic Bread
    '11111111-1111-1111-1111-111111111065'  // Tandoori Cheese Garlic Bread
  ]

  for (const itemId of items) {
    // 1. Rename "Small" to "Half"
    const { error: err1 } = await supabase
      .from('menu_item_sizes')
      .update({ size_label: 'Half' })
      .eq('menu_item_id', itemId)
      .eq('size_label', 'Small')

    if (err1) {
      console.error(`Failed to update Small -> Half for ${itemId}:`, err1.message)
    } else {
      console.log(`Success: Updated "Small" size to "Half" for ${itemId}`)
    }

    // 2. Rename "Medium" to "Full"
    const { error: err2 } = await supabase
      .from('menu_item_sizes')
      .update({ size_label: 'Full' })
      .eq('menu_item_id', itemId)
      .eq('size_label', 'Medium')

    if (err2) {
      console.error(`Failed to update Medium -> Full for ${itemId}:`, err2.message)
    } else {
      console.log(`Success: Updated "Medium" size to "Full" for ${itemId}`)
    }
  }

  console.log('Garlic bread size updates completed successfully!')
}

run().catch(console.error)
