
const crypto = require('crypto');
// Use global fetch

// Configurações
const APP_ID = '18363940729';
const SECRET = 'TF62ZM6XHKHJLOEDHSTYBJYUOCPXKBTE';
const API_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

const keywords = ['perfume feminino', 'fone bluetooth', 'air fryer', 'camisa'];

const combinations = [
  { label: 'Baseline (Relevância)', sortType: 1, listType: 0 },
  { label: 'Recentes/Vendas (?)', sortType: 2, listType: 0 },
  { label: 'Popularidade/Preço (?)', sortType: 3, listType: 0 },
  { label: 'Comissão/Vendas (?)', sortType: 5, listType: 0 },
  { label: 'Promoção Atual', sortType: 1, listType: 1 },
  { label: 'Top Performance/Destaque (?)', sortType: 1, listType: 2 },
  { label: 'Destaque + Vendas (?)', sortType: 2, listType: 2 },
  { label: 'Destaque + Comissão (?)', sortType: 5, listType: 2 },
];

function generateShopeeSignature(appId, timestamp, payload, secret) {
  const baseString = `${appId}${timestamp}${payload}${secret}`;
  return crypto.createHash('sha256').update(baseString).digest('hex');
}

async function searchProducts(keyword, sortType, listType, limit = 20) {
  const payloadObj = {
    query: `
      query productOfferV2($keyword: String, $limit: Int, $sortType: Int, $listType: Int, $page: Int) {
        productOfferV2(keyword: $keyword, limit: $limit, sortType: $sortType, listType: $listType, page: $page) {
          nodes {
            productName
            itemId
            shopId
            shopName
            price
            priceMin
            priceMax
            commission
            commissionRate
            sellerCommissionRate
            shopeeCommissionRate
            priceDiscountRate
            sales
            ratingStar
            shopType
            productLink
            offerLink
          }
        }
      }
    `,
    variables: {
      keyword,
      limit,
      sortType,
      listType,
      page: 1
    }
  };

  const payload = JSON.stringify(payloadObj, null, 0);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateShopeeSignature(APP_ID, timestamp, payload, SECRET);
  const authHeader = `SHA256 Credential=${APP_ID},Timestamp=${timestamp},Signature=${signature}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: payload
    });

    const json = await response.json();
    if (json.errors) {
      console.error(`  [API ERROR] ${json.errors[0].message}`);
      return [];
    }
    return json.data?.productOfferV2?.nodes || [];
  } catch (err) {
    console.error(`  [FETCH ERROR] ${err.message}`);
    return [];
  }
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

async function runDiagnostic() {
  console.log('=== SHOPEE DIAGNOSTIC: SORT & LIST TYPES ===');
  console.log(`Keywords: ${keywords.join(', ')}`);
  console.log(`Combinations: ${combinations.length}\n`);

  const results = [];

  for (const keyword of keywords) {
    console.log(`\n> Testing keyword: "${keyword}"`);
    
    // Baseline detection for overlap
    const baselineItems = await searchProducts(keyword, 1, 0);
    const baselineIds = new Set(baselineItems.map(p => p.itemId));

    for (const combo of combinations) {
      process.stdout.write(`  Testing ${combo.label} (sort:${combo.sortType}, list:${combo.listType})... `);
      
      let nodes = [];
      if (combo.sortType === 1 && combo.listType === 0) {
        nodes = baselineItems;
      } else {
        nodes = await searchProducts(keyword, combo.sortType, combo.listType);
      }

      if (nodes.length === 0) {
        console.log('FAILED');
        results.push({ 
          keyword, ...combo, 
          count: 0, status: 'D' 
        });
        continue;
      }

      console.log(`${nodes.length} items`);

      // Metrics
      const sales = nodes.map(p => parseInt(p.sales || 0));
      const ratings = nodes.map(p => parseFloat(p.ratingStar || 0)).filter(r => r > 0);
      const commRates = nodes.map(p => parseFloat(p.commissionRate || 0));
      const discounts = nodes.map(p => parseFloat(p.priceDiscountRate || 0));
      const shopTypes = nodes.map(p => p.shopType || '');
      
      const avgSales = sales.reduce((a, b) => a + b, 0) / sales.length;
      const medianSales = calculateMedian(sales);
      const top5Sales = Math.max(...sales.slice(0, 5));
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const avgCommRate = commRates.reduce((a, b) => a + b, 0) / commRates.length;
      const avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;
      const mallPreferred = shopTypes.filter(t => t.includes('Mall') || t.includes('Preferred')).length;
      
      const overlap = nodes.filter(p => baselineIds.has(p.itemId)).length;
      const overlapPercent = (overlap / nodes.length) * 100;

      // Checking order
      let isSalesSorted = true;
      for (let i = 0; i < Math.min(sales.length - 1, 10); i++) {
        if (sales[i] < sales[i+1] && sales[i+1] > 100) { // Tolerate some noise if small
          isSalesSorted = false;
          break;
        }
      }

      let isCommSorted = true;
      for (let i = 0; i < Math.min(commRates.length - 1, 10); i++) {
        if (commRates[i] < commRates[i+1]) {
          isCommSorted = false;
          break;
        }
      }

      results.push({
        keyword,
        ...combo,
        count: nodes.length,
        avgSales: avgSales.toFixed(0),
        medianSales,
        top5Sales,
        avgRating: avgRating.toFixed(1),
        avgCommRate: (avgCommRate * 100).toFixed(2) + '%',
        avgDiscount: avgDiscount.toFixed(1) + '%',
        mallPreferred,
        overlap: overlapPercent.toFixed(0) + '%',
        isSalesSorted,
        isCommSorted,
        sample: nodes.slice(0, 3).map(p => `${p.productName.substring(0, 20)} (S:${p.sales})`).join(' | ')
      });
    }
  }

  console.log('\n\n=== FINAL RESULTS TABLE ===\n');
  console.log('Keyword | Combination | Count | AvgSales | MedSales | AvgComm | AvgRating | Overlap | Hypothesis');
  console.log('--- | --- | --- | --- | --- | --- | --- | --- | ---');
  
  results.forEach(r => {
    let hypo = '-';
    if (r.count === 0) hypo = 'Invalid/Error';
    else if (r.sortType === 2 && r.isSalesSorted) hypo = 'Best Sellers?';
    else if (r.sortType === 5 && r.isCommSorted) hypo = 'High Commission';
    else if (r.listType === 2) hypo = 'Featured?';

    console.log(`${r.keyword} | ${r.label} | ${r.count} | ${r.avgSales} | ${r.medianSales} | ${r.avgCommRate} | ${r.avgRating} | ${r.overlap} | ${hypo}`);
  });

  console.log('\n\n=== SUMMARY OF FINDINGS ===\n');
  
  // SortType findings
  const sortTypes = [1, 2, 3, 5];
  sortTypes.forEach(st => {
    const stResults = results.filter(r => r.sortType === st && r.listType === 0);
    const avgOverlap = stResults.reduce((a, b) => a + parseFloat(b.overlap), 0) / stResults.length;
    console.log(`SortType ${st}: Avg Overlap with Baseline: ${avgOverlap.toFixed(0)}%`);
  });

  // ListType findings
  const listTypes = [0, 1, 2];
  listTypes.forEach(lt => {
    const ltResults = results.filter(r => r.listType === lt && r.sortType === 1);
    const avgOverlap = ltResults.reduce((a, b) => a + parseFloat(b.overlap), 0) / ltResults.length;
    console.log(`ListType ${lt}: Avg Overlap with Baseline: ${avgOverlap.toFixed(0)}%`);
  });
}

runDiagnostic();
