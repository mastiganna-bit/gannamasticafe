const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*, menu_item_sizes(*)');
  
  if (error) {
    console.error('Error fetching menu items:', error);
  } else {
    console.log('Total Menu Items:', data.length);
    const addOns = data.filter(item => item.category === 'Add-on' || item.name.toLowerCase().includes('cheese'));
    console.log('Add-on or Cheese items:', JSON.stringify(addOns, null, 2));
  }
}
test();
