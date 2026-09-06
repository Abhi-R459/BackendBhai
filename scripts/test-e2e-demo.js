const { spawn } = require('child_process');
const http = require('http');

console.log('=== BackendBhai Full Stack & Amazon Store E2E Test ===\n');

function startService(name, dir, port) {
  const proc = spawn('node', ['dist/index.js'], {
    cwd: dir,
    env: { ...process.env, PORT: port },
    stdio: 'pipe'
  });
  proc.stdout.on('data', d => console.log(`[${name}] ${d.toString().trim()}`));
  proc.stderr.on('data', d => console.error(`[${name} ERR] ${d.toString().trim()}`));
  return proc;
}

function waitPort(port) {
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        resolve();
      });
      req.on('error', () => setTimeout(check, 100));
    };
    check();
  });
}

function httpJson(urlStr, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'content-type': 'application/json',
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let json = data;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ statusCode: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const services = [];
  try {
    console.log('[1/5] Booting all 7 microservices & web storefronts...');
    services.push(startService('MockPaymentAPI', 'apps/demo-store/mock-payment-api', 4000));
    services.push(startService('PaymentService', 'apps/demo-store/payment-service', 3003));
    services.push(startService('AuthService', 'apps/demo-store/auth-service', 3001));
    services.push(startService('OrderService', 'apps/demo-store/order-service', 3002));
    services.push(startService('APIGateway', 'apps/demo-store/api-gateway', 3000));
    services.push(startService('MasterErrorInjector', 'apps/demo-store/frontend', 4002));
    services.push(startService('AmazonStorefront', 'apps/demo-store/amazon-store', 4003));

    console.log('[2/5] Waiting for all 7 health checks to pass...');
    await Promise.all([
      waitPort(4000),
      waitPort(3003),
      waitPort(3001),
      waitPort(3002),
      waitPort(3000),
      waitPort(4002),
      waitPort(4003)
    ]);
    console.log('✔ All 7 services are online and responding!\n');

    console.log('[3/5] Verifying UI servers:');
    // Check Master Error Injector (:4002)
    const masterRes = await new Promise(res => {
      http.get('http://localhost:4002/', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
      });
    });
    if (masterRes.includes('Master Error Injector')) {
      console.log('  ✔ Master Error Injector UI (:4002) verified.');
    }

    // Check Amazon Storefront (:4003)
    const amzRes = await new Promise(res => {
      http.get('http://localhost:4003/', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
      });
    });
    if (amzRes.includes('amazon.com') && amzRes.includes('Featured Developer Gear')) {
      console.log('  ✔ Amazon Storefront UI (:4003) verified.');
    }

    console.log('\n[4/5] Testing Dynamic Chaos Synchronization:');
    
    // Scenario A: Normal mode
    console.log('  -> Setting Master Chaos Mode to [NORMAL]...');
    await httpJson('http://localhost:3000/api/chaos-state', 'POST', { mode: 'normal' });
    const normalOrderStart = Date.now();
    const normalOrder = await httpJson('http://localhost:3000/api/orders', 'POST', {
      userId: 'user-42',
      items: [{ id: 'item-1', name: 'Mechanical Keyboard', qty: 1, price: 89.99 }]
    });
    const normalElapsed = Date.now() - normalOrderStart;
    console.log(`     Amazon Order Result: HTTP ${normalOrder.statusCode} in ${normalElapsed}ms (Mode: ${normalOrder.data.activeChaosMode})`);
    if (normalOrder.statusCode !== 201 || normalElapsed > 1500) {
      throw new Error(`Normal order expected ~200ms 201, got ${normalOrder.statusCode} in ${normalElapsed}ms`);
    }

    // Scenario B: Heavy Order mode (toggled on Master, affects Amazon order)
    console.log('  -> Toggling Master Chaos Mode to [HEAVY] (expecting 3s DB delay)...');
    await httpJson('http://localhost:3000/api/chaos-state', 'POST', { mode: 'heavy' });
    const heavyOrderStart = Date.now();
    const heavyOrder = await httpJson('http://localhost:3000/api/orders', 'POST', {
      userId: 'user-42',
      items: [{ id: 'item-1', name: 'Mechanical Keyboard', qty: 1, price: 89.99 }]
    });
    const heavyElapsed = Date.now() - heavyOrderStart;
    console.log(`     Amazon Order Result: HTTP ${heavyOrder.statusCode} in ${heavyElapsed}ms (Mode: ${heavyOrder.data.activeChaosMode})`);
    if (heavyElapsed < 2800) {
      throw new Error(`Heavy order expected >= 3000ms delay, got ${heavyElapsed}ms`);
    }

    // Scenario C: Auth Timeout mode (toggled on Master, affects Amazon order)
    console.log('  -> Toggling Master Chaos Mode to [INVALID-AUTH] (expecting 5s timeout error)...');
    await httpJson('http://localhost:3000/api/chaos-state', 'POST', { mode: 'invalid-auth' });
    const authOrderStart = Date.now();
    const authOrder = await httpJson('http://localhost:3000/api/orders', 'POST', {
      userId: 'user-42',
      items: [{ id: 'item-1', name: 'Mechanical Keyboard', qty: 1, price: 89.99 }]
    });
    const authElapsed = Date.now() - authOrderStart;
    console.log(`     Amazon Order Result: HTTP ${authOrder.statusCode} in ${authElapsed}ms (Error: ${authOrder.data.error})`);
    if (authOrder.statusCode !== 401 || authElapsed < 4800) {
      throw new Error(`Auth timeout expected 401 in >= 5000ms, got ${authOrder.statusCode} in ${authElapsed}ms`);
    }

    // Scenario D: Payment 503 mode (toggled on Master, affects Amazon order)
    console.log('  -> Toggling Master Chaos Mode to [PAYMENT-503] (expecting 503 failure)...');
    await httpJson('http://localhost:3000/api/chaos-state', 'POST', { mode: 'payment-503' });
    const payOrder = await httpJson('http://localhost:3000/api/orders', 'POST', {
      userId: 'user-42',
      items: [{ id: 'item-1', name: 'Mechanical Keyboard', qty: 1, price: 89.99 }]
    });
    console.log(`     Amazon Order Result: HTTP ${payOrder.statusCode} (Error: ${payOrder.data.error})`);
    if (payOrder.statusCode !== 503) {
      throw new Error(`Payment 503 expected HTTP 503, got ${payOrder.statusCode}`);
    }

    console.log('\n[5/5] Resetting Chaos State to NORMAL...');
    await httpJson('http://localhost:3000/api/chaos-state', 'POST', { mode: 'normal' });

    console.log('\n======================================================');
    console.log('   AMAZON STOREFRONT & MASTER ERROR INJECTOR          ');
    console.log('   DYNAMIC CHAOS SYNCHRONIZATION 100% VERIFIED!        ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    console.log('Shutting down services...');
    services.forEach(p => p.kill());
    setTimeout(() => process.exit(process.exitCode || 0), 1000);
  }
})();
