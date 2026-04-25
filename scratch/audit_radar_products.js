const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, marketplace, created_at, commission_value, current_price')
    .ilike('category', '[RADAR]%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Recent Radar Products:');
    data.forEach(p => {
      console.log(`- [${p.id}] ${p.name}`);
      console.log(`  Category: ${p.category}`);
      console.log(`  Price: R$ ${p.current_price} | Comm: R$ ${p.commission_value}`);
      console.log(`  Created: ${p.created_at}`);
      console.log('---');
    });
  }
}

checkRecentProducts();
