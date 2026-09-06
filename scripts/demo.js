// scripts/demo.js — Cross-platform one-command demo runner
const { execSync } = require('child_process');

console.log('==============================================');
console.log('   BackendBhai — One-Command Demo Launcher    ');
console.log('==============================================\n');

try {
  console.log('[1/3] Bringing up containers via Docker Compose...');
  execSync('docker compose up -d --build', { stdio: 'inherit' });
  
  console.log('\n[2/3] Waiting 6 seconds for services to initialize...');
  setTimeout(() => {
    console.log('\n[3/3] Seeding demo database with 50+ diverse requests...');
    try {
      execSync('node scripts/seed.js', { stdio: 'inherit' });
      console.log('\n==============================================');
      console.log('   Demo environment is READY to present!       ');
      console.log('   DevTools UI:       http://localhost:4001   ');
      console.log('   E-Commerce Demo:   http://localhost:4002   ');
      console.log('   API Gateway:       http://localhost:3000   ');
      console.log('==============================================');
    } catch (e) {
      console.error('Seeding encountered an error:', e.message);
    }
  }, 6000);
} catch (err) {
  console.error('Docker compose failed:', err.message);
  console.log('\nFalling back to direct local seeding & database verification...');
  require('./init-db.js');
  require('./seed.js');
}
