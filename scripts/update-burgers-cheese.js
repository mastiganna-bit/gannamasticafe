const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
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

async function updateBurgers() {
  console.log('Updating Burger Binge items to allow extra cheese...');
  
  const { data, error } = await supabase
    .from('menu_items')
    .update({
      allow_extra_cheese: true,
      extra_cheese_price_paise: 2000 // ₹20
    })
    .eq('category', 'Burger Binge');

  if (error) {
    console.error('Error updating items:', error);
  } else {
    console.log('Successfully updated burgers!');
  }
}

updateBurgers();
