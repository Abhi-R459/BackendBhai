const { execSync } = require('child_process');
console.log('=== Resetting BackendBhai Databases ===');

try {
  console.log('Stopping containers and removing volumes...');
  execSync('docker compose down -v', { stdio: 'inherit' });
  console.log('Starting postgres...');
  execSync('docker compose up -d postgres', { stdio: 'inherit' });
  console.log('Waiting for postgres to become healthy...');
  setTimeout(() => {
    require('./init-db.js');
  }, 4000);
} catch (e) {
  console.log('Docker reset encountered:', e.message);
  console.log('Falling back to local init-db.js...');
  require('./init-db.js');
}
