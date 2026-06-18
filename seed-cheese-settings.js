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

async function seed() {
  console.log('Seeding extra cheese settings into menu_items...');
  const itemId = '00000000-0000-0000-0000-000000000000';
  
  // 1. Check if the settings menu item already exists
  const { data: existingItem } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!existingItem) {
    const { error: insertErr } = await supabase
      .from('menu_items')
      .insert({
        id: itemId,
        name: 'Extra Cheese Settings',
        description: 'System configurations for Extra Cheese prices.',
        category: 'System',
        image_path: '/images/system.png',
        is_available: false,
        has_sizes: true
      });

    if (insertErr) {
      console.error('Error inserting system menu item:', insertErr);
      return;
    }
    console.log('Inserted System menu item successfully.');
  } else {
    console.log('System menu item already exists.');
  }

  // 2. Check and insert size prices
  const sizes = [
    { label: 'Standard Price', price: 2000, order: 1 },
    { label: 'Premium Pizza (Small/Half) Price', price: 3000, order: 2 },
    { label: 'Premium Pizza (Medium/Large) Price', price: 5000, order: 3 },
    { label: 'Special Item Price', price: 3000, order: 4 }
  ];

  for (const sz of sizes) {
    const { data: existingSize } = await supabase
      .from('menu_item_sizes')
      .select('*')
      .eq('menu_item_id', itemId)
      .eq('size_label', sz.label)
      .single();

    if (!existingSize) {
      const { error: sizeErr } = await supabase
        .from('menu_item_sizes')
        .insert({
          menu_item_id: itemId,
          size_label: sz.label,
          price_paise: sz.price,
          sort_order: sz.order
        });

      if (sizeErr) {
        console.error(`Error inserting size ${sz.label}:`, sizeErr);
      } else {
        console.log(`Inserted size ${sz.label} successfully.`);
      }
    } else {
      console.log(`Size ${sz.label} already exists.`);
    }
  }

  console.log('Seeding completed!');
}

seed();
