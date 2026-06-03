import assert from 'node:assert/strict';

async function run() {
  const response = await fetch('http://localhost:3000/api/topics');
  assert.equal(response.status, 200, 'status should be 200');

  const payload = await response.json();
  assert.ok(payload && typeof payload === 'object', 'response should be an object');
  assert.ok(Array.isArray(payload.items), 'topics.items must be array');

  console.log('TOPIC_API_OK');
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
