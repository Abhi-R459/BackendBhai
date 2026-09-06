const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== BackendBhai DB Initializer ===');

const devtoolsSqlPath = path.resolve(__dirname, '../infrastructure/db/devtools/001_initial.sql');
const ecommerceSqlPath = path.resolve(__dirname, '../infrastructure/db/ecommerce/001_initial.sql');

const devtoolsSql = fs.readFileSync(devtoolsSqlPath, 'utf8');
const ecommerceSql = fs.readFileSync(ecommerceSqlPath, 'utf8');

async function runWithPg() {
  let pg;
  try {
    pg = require('pg');
  } catch (e) {
    return false;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || 5432;
  const user = process.env.POSTGRES_USER || 'app';
  const password = process.env.POSTGRES_PASSWORD || 'secret';

  // 1. Connect to postgres root db to create databases
  const rootClient = new pg.Client({ host, port, user, password, database: 'postgres' });
  try {
    await rootClient.connect();
    console.log('Connected to PostgreSQL root...');
    const res = await rootClient.query("SELECT datname FROM pg_database WHERE datname IN ('devtools', 'ecommerce')");
    const existing = res.rows.map(r => r.datname);
    if (!existing.includes('devtools')) {
      await rootClient.query('CREATE DATABASE devtools');
      console.log('Created database devtools');
    }
    if (!existing.includes('ecommerce')) {
      await rootClient.query('CREATE DATABASE ecommerce');
      console.log('Created database ecommerce');
    }
    await rootClient.end();
  } catch (err) {
    console.warn('Root connection notice:', err.message);
  }

  // 2. Connect to devtools
  try {
    const devtoolsClient = new pg.Client({ host, port, user, password, database: 'devtools' });
    await devtoolsClient.connect();
    await devtoolsClient.query(devtoolsSql);
    console.log('Successfully applied devtools schema & indexes.');
    await devtoolsClient.end();
  } catch (err) {
    console.error('Error applying devtools schema:', err.message);
  }

  // 3. Connect to ecommerce
  try {
    const ecommerceClient = new pg.Client({ host, port, user, password, database: 'ecommerce' });
    await ecommerceClient.connect();
    await ecommerceClient.query(ecommerceSql);
    console.log('Successfully applied ecommerce schema & seed data.');
    await ecommerceClient.end();
  } catch (err) {
    console.error('Error applying ecommerce schema:', err.message);
  }

  return true;
}

function runWithDocker() {
  try {
    console.log('Attempting initialization via Docker exec...');
    execSync('docker compose exec -T postgres psql -U app -d postgres -c "SELECT \'CREATE DATABASE devtools\' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = \'devtools\')\\gexec"', { stdio: 'inherit' });
    execSync('docker compose exec -T postgres psql -U app -d postgres -c "SELECT \'CREATE DATABASE ecommerce\' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = \'ecommerce\')\\gexec"', { stdio: 'inherit' });
    execSync('docker compose exec -T postgres psql -U app -d devtools -f /docker-entrypoint-initdb.d/devtools/001_initial.sql', { stdio: 'inherit' });
    execSync('docker compose exec -T postgres psql -U app -d ecommerce -f /docker-entrypoint-initdb.d/ecommerce/001_initial.sql', { stdio: 'inherit' });
    console.log('Docker-based DB initialization succeeded.');
    return true;
  } catch (e) {
    console.log('Docker exec not available or failed:', e.message);
    return false;
  }
}

(async () => {
  const pgSuccess = await runWithPg();
  if (!pgSuccess) {
    runWithDocker();
  }
  console.log('DB initialization finished.');
})();
