// scripts/seed.js — BackendBhai Demo Data Seeder (Task I-07)
// Generates 50+ requests covering all deliberate failure scenarios

const http = require('http');
const fs = require('fs');
const path = require('path');

const GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

function postOrder(payload, headers = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(`${GATEWAY_URL}/api/orders`);
    const bodyStr = JSON.stringify(payload);
    const start = Date.now();

    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(bodyStr),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          durationMs: duration,
          data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        error: err.message,
        durationMs: Date.now() - start
      });
    });

    req.write(bodyStr);
    req.end();
  });
}

function checkGatewayOnline() {
  return new Promise((resolve) => {
    const parsed = new URL(`${GATEWAY_URL}/health`);
    const req = http.get({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      timeout: 1500
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
  });
}

async function seedDirectDb() {
  console.log('[Seed] API Gateway is not responding. Falling back to direct database seed...');
  let pg;
  try {
    pg = require('pg');
  } catch (_) {
    console.log('[Seed] pg module not installed locally. Direct DB seed skipped.');
    return;
  }

  const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.POSTGRES_USER || 'app',
    password: process.env.POSTGRES_PASSWORD || 'secret',
    database: 'devtools'
  });

  try {
    await client.connect();
    console.log('[Seed] Connected to devtools database. Inserting synthetic traces...');

    const baseTime = Date.now() - 3600000; // 1 hour ago
    const traceRows = [];

    // Generate 55 synthetic requests matching contracts/DATA_MODEL.md
    for (let i = 1; i <= 55; i++) {
      const traceId = `5b8efff798038103d269b63381${i.toString().padStart(6, '0')}`;
      const rootSpanId = `eee19b7ec3${i.toString().padStart(6, '0')}`;
      const timestamp = new Date(baseTime + i * 65000).toISOString();
      
      let statusCode = 201;
      let durationMs = 350 + Math.floor(Math.random() * 200);
      let hasError = false;
      let scenario = 'Normal Order';

      if (i % 8 === 0) {
        // Slow DB delay (>10 items)
        durationMs = 3100 + Math.floor(Math.random() * 200);
        scenario = 'Heavy Order (>10 items, slow DB)';
      } else if (i % 7 === 0) {
        // Auth timeout
        statusCode = 401;
        durationMs = 5020 + Math.floor(Math.random() * 50);
        hasError = true;
        scenario = 'Invalid Auth Timeout (5s)';
      } else if (i % 11 === 0) {
        // WireMock 503
        statusCode = 503;
        durationMs = 420;
        hasError = true;
        scenario = 'Payment Provider 503 Failure';
      } else if (i % 5 === 0) {
        // WireMock slow delay
        durationMs = 5120 + Math.floor(Math.random() * 100);
        scenario = 'Slow Payment Provider (5s)';
      }

      await client.query(`
        INSERT INTO traces (
          trace_id, root_service, method, path, status_code, duration_ms,
          timestamp, has_error, request_body, response_body, services
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (trace_id) DO UPDATE SET duration_ms = EXCLUDED.duration_ms
      `, [
        traceId,
        'api-gateway',
        'POST',
        '/api/orders',
        statusCode,
        durationMs,
        timestamp,
        hasError,
        JSON.stringify({ userId: 'user-42', scenario }),
        JSON.stringify({ orderId: `ord-seed-${i}`, status: statusCode === 201 ? 'created' : 'failed' }),
        ['api-gateway', 'auth-service', 'order-service', 'payment-service']
      ]);

      // Insert root span
      await client.query(`
        INSERT INTO spans (
          span_id, trace_id, parent_span_id, service, operation, kind,
          start_timestamp, duration_ms, status, status_code
        ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (span_id) DO NOTHING
      `, [
        rootSpanId,
        traceId,
        'api-gateway',
        'POST /api/orders',
        'server',
        timestamp,
        durationMs,
        hasError ? 'ERROR' : 'OK',
        statusCode
      ]);

      // Insert correlated log event
      await client.query(`
        INSERT INTO log_events (
          trace_id, span_id, service, level, message, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        traceId,
        rootSpanId,
        'api-gateway',
        hasError ? 'error' : 'info',
        `Processed /api/orders: ${scenario} in ${durationMs}ms (Status ${statusCode})`,
        timestamp
      ]);
    }

    console.log('[Seed] Successfully seeded 55 synthetic requests directly into devtools DB.');
    await client.end();
  } catch (dbErr) {
    console.warn('[Seed] Direct DB seed encountered:', dbErr.message);
  }
}

async function seedViaHttp() {
  console.log('====================================================');
  console.log(' BackendBhai Seed Script — Generating 50+ Requests  ');
  console.log(` Target Gateway: ${GATEWAY_URL}                    `);
  console.log('====================================================\n');

  const totalRequests = 55;
  let successCount = 0;
  let slowDbCount = 0;
  let authTimeoutCount = 0;
  let slowPaymentCount = 0;
  let failure503Count = 0;

  for (let i = 1; i <= totalRequests; i++) {
    const isHeavy = (i % 7 === 0);
    const isInvalidAuth = (i % 9 === 0);
    const isSlowPayment = (i % 6 === 0);
    const is503 = (i % 15 === 0);

    let items = [{ id: 'item-1', name: 'Mechanical Keyboard', qty: 1, price: 89.99 }];
    let headers = {
      'authorization': 'Bearer token-user-42'
    };

    if (isInvalidAuth) {
      headers['authorization'] = 'Bearer invalid';
      authTimeoutCount++;
      process.stdout.write(`[${i}/${totalRequests}] Sending Auth Timeout request... `);
    } else if (isHeavy) {
      items = [];
      for (let k = 1; k <= 12; k++) {
        items.push({ id: `item-${k}`, name: `Bulk Item #${k}`, qty: 1, price: 20.00 });
      }
      slowDbCount++;
      process.stdout.write(`[${i}/${totalRequests}] Sending Heavy Order (>10 items, 3s DB delay)... `);
    } else if (is503) {
      headers['x-simulate-503'] = 'true';
      failure503Count++;
      process.stdout.write(`[${i}/${totalRequests}] Sending Payment 503 failure request... `);
    } else if (isSlowPayment) {
      headers['x-simulate-slow'] = 'true';
      slowPaymentCount++;
      process.stdout.write(`[${i}/${totalRequests}] Sending Slow Payment (5s delay) request... `);
    } else {
      successCount++;
      process.stdout.write(`[${i}/${totalRequests}] Sending Normal Order... `);
    }

    const res = await postOrder({ userId: 'user-42', items }, headers);
    console.log(`HTTP ${res.statusCode} (${res.durationMs}ms)`);

    // Pace requests slightly
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n====================================================');
  console.log(' Seed Summary:                                      ');
  console.log(` Total requests fired:     ${totalRequests}         `);
  console.log(` - Normal Orders:          ${successCount}          `);
  console.log(` - Slow DB Spans:          ${slowDbCount} (>10 items)`);
  console.log(` - Auth Timeouts:          ${authTimeoutCount} (invalid token)`);
  console.log(` - Slow Payments:          ${slowPaymentCount} (5s delay)`);
  console.log(` - 503 Payment Errors:     ${failure503Count}       `);
  console.log('====================================================\n');
}

(async () => {
  const isOnline = await checkGatewayOnline();
  if (isOnline) {
    await seedViaHttp();
  } else {
    await seedDirectDb();
  }
})();
