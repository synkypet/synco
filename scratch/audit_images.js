
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function audit() {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, image_url, original_url, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const byImage = {};
  const duplicates = [];

  products.forEach(p => {
    if (!byImage[p.image_url]) {
      byImage[p.image_url] = [];
    }
    byImage[p.image_url].push(p);
  });

  for (const img in byImage) {
    if (byImage[img].length > 1) {
      duplicates.push({
        image: img,
        items: byImage[img]
      });
    }
  }

  console.log(`Audited 100 products. Found ${duplicates.length} image groups with duplicates.`);
  
  duplicates.forEach((group, i) => {
    console.log(`\nGroup ${i+1}: ${group.items[0].name}`);
    group.items.forEach(item => {
      console.log(`  - [${item.id}] ${item.original_url} (Created: ${item.created_at})`);
    });
  });
}

audit();
