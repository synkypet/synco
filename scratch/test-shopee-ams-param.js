
const crypto = require('crypto');

const APP_ID = "18363940729";
const SECRET = "TF62ZM6XHKHJLOEDHSTYBJYUOCPXKBTE";
const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

async function fetchShopee(query) {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query });
    const factor = APP_ID + timestamp + payload + SECRET;
    const signature = crypto.createHash('sha256').update(factor).digest('hex');

    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`
        },
        body: payload
    });

    return await response.json();
}

async function runTest() {
    const keyword = "perfume feminino";
    const sortType = 5;
    const limit = 20;

    console.log("--- DIAGNOSTIC: isAMSOffer Validation ---");

    // Query A: Standard
    const queryA = `{ productOfferV2(keyword: "${keyword}", sortType: ${sortType}, listType: 0, limit: ${limit}) { nodes { itemId commissionRate } } }`;
    const resA = await fetchShopee(queryA);
    const nodesA = resA?.data?.productOfferV2?.nodes || [];
    const idsA = nodesA.map(n => String(n.itemId)).sort();
    const sumCommA = nodesA.reduce((acc, n) => acc + (parseFloat(n.commissionRate) || 0), 0);
    const avgCommA = nodesA.length > 0 ? sumCommA / nodesA.length : 0;

    // Query B: AMS Filter
    const queryB = `{ productOfferV2(keyword: "${keyword}", sortType: ${sortType}, listType: 0, limit: ${limit}, isAMSOffer: true) { nodes { itemId commissionRate } } }`;
    const resB = await fetchShopee(queryB);
    const nodesB = resB?.data?.productOfferV2?.nodes || [];
    const idsB = nodesB.map(n => String(n.itemId)).sort();
    const sumCommB = nodesB.reduce((acc, n) => acc + (parseFloat(n.commissionRate) || 0), 0);
    const avgCommB = nodesB.length > 0 ? sumCommB / nodesB.length : 0;

    console.log(`Results A: ${nodesA.length} items`);
    console.log(`Results B: ${nodesB.length} items`);

    const intersection = idsA.filter(id => idsB.includes(id));
    console.log(`Intersection: ${intersection.length} items match`);

    console.log(`Avg Commission A: ${(avgCommA * 100).toFixed(2)}%`);
    console.log(`Avg Commission B: ${(avgCommB * 100).toFixed(2)}%`);

    console.log("\n--- ERRORS CHECK ---");
    if (resB.errors) {
        console.log("Query B Errors:", JSON.stringify(resB.errors));
    } else {
        console.log("Query B: No errors (Parameter accepted but maybe ignored)");
    }

    console.log("\n--- ITEM IDs (Top 5) ---");
    console.log("A:", idsA.slice(0, 5).join(", "));
    console.log("B:", idsB.slice(0, 5).join(", "));

    console.log("\n--- FINAL CONCLUSION ---");
    if (intersection.length === nodesA.length && nodesA.length > 0) {
        console.log("RESULT: isAMSOffer is IGNORED (Identical results)");
    } else if (nodesB.length === 0 && nodesA.length > 0) {
        console.log("RESULT: isAMSOffer is FILTERING (Returned 0 items)");
    } else {
        console.log("RESULT: isAMSOffer is FUNCTIONAL (Different results)");
    }
}

runTest();
