
async function testSync() {
  const channel_id = '7a7da5a9-2ce6-4e01-acc7-c994dbc4b113';
  console.log('Testing Sync for channel:', channel_id);
  
  const res = await fetch('http://localhost:3001/api/wasender/groups/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel_id })
  });
  
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testSync();
