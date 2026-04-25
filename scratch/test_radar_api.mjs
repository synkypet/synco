
const keywords = ['iphone', 'mouse gamer', 'geladeira', 'chinelo'];

async function testRadar() {
  for (const keyword of keywords) {
    console.log(`\nTesting keyword: "${keyword}"`);
    try {
      const response = await fetch('http://localhost:3000/api/radar/fetch-shopee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword, 
          sortType: 1, 
          listType: 0, 
          page: 1, 
          limit: 10 
        })
      });

      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      console.log(`Returned products: ${data.products.length}`);
      console.log(`Dropped by integrity: ${data.telemetry?.dropped_by_integrity || 0}`);
      
      if (data.products.length > 0) {
        const p = data.products[0];
        console.log(`First item: "${p.name}"`);
        console.log(`Fields Check:`, {
          hasSales: p.sales !== undefined,
          hasRating: p.rating_star !== undefined,
          hasShopName: !!p.shop_name,
          hasBrazilFriendly: !!p.brazil_friendly,
          urlType: p.original_url?.includes('/product/') ? 'Canonical' : 'Other'
        });
        console.log(`Sample Price: ${p.current_price} | Commission: ${p.commission_percent}%`);
      }
    } catch (err) {
      console.error(`Failed to test "${keyword}":`, err.message);
    }
  }
}

testRadar();
