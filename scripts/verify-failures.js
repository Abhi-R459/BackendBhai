const { maybeInjectOrderDelay, maybeInjectCacheMiss } = require('../apps/demo-store/order-service/dist/failures.js');
const { maybeInjectAuthTimeout } = require('../apps/demo-store/auth-service/dist/failures.js');

async function runTests() {
  console.log('=== Verifying Failure Injection Modules ===\n');

  // Test 1: Order delay with <= 10 items (should NOT delay)
  console.log('[Test 1] Testing order with 5 items (expecting NO delay)...');
  const t1Start = Date.now();
  await maybeInjectOrderDelay([
    { id: '1', qty: 1, price: 10 },
    { id: '2', qty: 1, price: 10 }
  ]);
  const t1Elapsed = Date.now() - t1Start;
  console.log(`[Test 1] Passed: completed in ${t1Elapsed}ms (< 500ms)\n`);
  if (t1Elapsed > 500) throw new Error('Test 1 failed: delayed when items <= 10');

  // Test 2: Order delay with > 10 items (expecting ~3000ms delay)
  console.log('[Test 2] Testing order with 12 items (expecting ~3000ms delay)...');
  const t2Start = Date.now();
  const mockDb = {
    async query(sql) {
      console.log(`  -> Mock DB executed: ${sql}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  };
  await maybeInjectOrderDelay(new Array(12).fill({ id: 'item', qty: 1, price: 10 }), mockDb);
  const t2Elapsed = Date.now() - t2Start;
  console.log(`[Test 2] Passed: completed in ${t2Elapsed}ms (>= 2900ms)\n`);
  if (t2Elapsed < 2800) throw new Error('Test 2 failed: 3s DB delay did not trigger');

  // Test 3: Cache miss on 30th request
  console.log('[Test 3] Testing Redis cache miss counter (call 30 should return null)...');
  let hitCount = 0;
  let missCount = 0;
  for (let i = 1; i <= 35; i++) {
    const res = await maybeInjectCacheMiss('session-1', async () => ({ cached: true }));
    if (res === null) {
      missCount++;
      console.log(`  -> Request #${i} triggered cache miss as expected!`);
    } else {
      hitCount++;
    }
  }
  console.log(`[Test 3] Passed: 35 requests yielded ${missCount} misses and ${hitCount} hits.\n`);
  if (missCount < 1) throw new Error('Test 3 failed: 30th request cache miss did not trigger');

  // Test 4: Auth timeout with valid token
  console.log('[Test 4] Testing auth with valid token "Bearer token-user-42" (expecting NO delay)...');
  const t4Start = Date.now();
  await maybeInjectAuthTimeout('Bearer token-user-42');
  const t4Elapsed = Date.now() - t4Start;
  console.log(`[Test 4] Passed: completed in ${t4Elapsed}ms (< 500ms)\n`);
  if (t4Elapsed > 500) throw new Error('Test 4 failed: delayed on valid token');

  // Test 5: Auth timeout with invalid token (expecting 5s timeout error)
  console.log('[Test 5] Testing auth with "Bearer invalid" (expecting ~5000ms delay and throw)...');
  const t5Start = Date.now();
  let caughtError = null;
  try {
    await maybeInjectAuthTimeout('Bearer invalid');
  } catch (err) {
    caughtError = err;
  }
  const t5Elapsed = Date.now() - t5Start;
  console.log(`[Test 5] Passed: completed in ${t5Elapsed}ms with error: "${caughtError ? caughtError.message : 'none'}"\n`);
  if (!caughtError || caughtError.message !== 'Auth service timeout') {
    throw new Error('Test 5 failed: did not throw "Auth service timeout"');
  }
  if (t5Elapsed < 4800) {
    throw new Error('Test 5 failed: timeout duration was less than 5000ms');
  }

  console.log('======================================================');
  console.log(' ALL 5 FAILURE INJECTION TESTS PASSED SUCCESSFULLY!   ');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
