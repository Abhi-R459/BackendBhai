const { spawn } = require('child_process');
const http = require('http');

console.log('=== BackendBhai Full Stack Local Development ===\n');

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
      req.on('error', () => setTimeout(check, 500));
    };
    check();
  });
}

(async () => {
  try {
    console.log('Booting all 7 microservices & web storefronts...');
    startService('MockPaymentAPI', 'apps/demo-store/mock-payment-api', 4000);
    startService('PaymentService', 'apps/demo-store/payment-service', 3003);
    startService('AuthService', 'apps/demo-store/auth-service', 3001);
    startService('OrderService', 'apps/demo-store/order-service', 3002);
    startService('APIGateway', 'apps/demo-store/api-gateway', 3000);
    startService('MasterErrorInjector', 'apps/demo-store/frontend', 4002);
    startService('AmazonStorefront', 'apps/demo-store/amazon-store', 4003);

    console.log('\nWaiting for all services to come online...');
    await Promise.all([
      waitPort(4000),
      waitPort(3003),
      waitPort(3001),
      waitPort(3002),
      waitPort(3000),
      waitPort(4002),
      waitPort(4003)
    ]);
    
    console.log('\n======================================================');
    console.log('   ALL SERVICES ONLINE AND RUNNING');
    console.log('======================================================');
    console.log('   Master Error Injector UI: http://localhost:4002');
    console.log('   Amazon Storefront UI:     http://localhost:4003');
    console.log('   API Gateway:              http://localhost:3000');
    console.log('======================================================');
    console.log('Press Ctrl+C to stop all services.\n');
    
  } catch (err) {
    console.error('Startup failed:', err);
    process.exitCode = 1;
  }
})();
