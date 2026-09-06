import express, { Request, Response } from 'express';
import http from 'http';
import { maybeInjectOrderDelay, maybeInjectCacheMiss, OrderItem } from './failures';

const app = express();
const port = process.env.PORT || 3002;

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://app:secret@localhost:5432/ecommerce';

app.use(express.json());

// In-memory fallback stores in case Postgres/Redis are in isolated mode
const inMemoryOrders: any[] = [];
const inMemoryProducts = [
  { id: 'item-1', name: 'Mechanical Keyboard', price: 89.99, stock: 150 },
  { id: 'item-2', name: 'Wireless Mouse', price: 49.99, stock: 200 },
  { id: 'item-3', name: '4K IPS Monitor', price: 349.00, stock: 75 },
  { id: 'item-4', name: 'USB-C Docking Station', price: 69.50, stock: 120 },
  { id: 'item-5', name: 'Noise-Canceling Headphones', price: 199.99, stock: 90 }
];

// Database query wrapper with fallback
let pgPool: any = null;
try {
  const { Pool } = require('pg');
  pgPool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 1500 });
} catch (_) {}

const db = {
  async query(text: string, params?: any[]) {
    if (pgPool) {
      try {
        return await pgPool.query(text, params);
      } catch (err: any) {
        // Fallback gracefully when DB is not reachable
      }
    }
    if (text && text.includes('pg_sleep')) {
      await new Promise(res => setTimeout(res, 3000));
    }
    return { rows: [] };
  }
};

function forwardPayment(orderId: string, amount: number, headers: Record<string, string>): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${PAYMENT_SERVICE_URL}/payments`);
    const payload = JSON.stringify({ orderId, amount });
    
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsedData: any = data;
        try {
          parsedData = JSON.parse(data);
        } catch (_) {}
        resolve({ statusCode: res.statusCode || 200, data: parsedData });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

app.get('/products', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY id ASC');
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err: any) {
    console.warn('[OrderService] Fallback to in-memory products:', err.message);
  }
  res.json(inMemoryProducts);
});

app.get('/orders', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch (err: any) {
    console.warn('[OrderService] Fallback to in-memory orders:', err.message);
  }
  res.json(inMemoryOrders);
});

app.get('/orders/:id', async (req: Request, res: Response) => {
  const orderId = req.params.id;
  try {
    const result = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
  } catch (err: any) {
    console.warn('[OrderService] DB error on /orders/:id:', err.message);
  }
  const match = inMemoryOrders.find(o => o.id === orderId);
  if (match) return res.json(match);
  res.status(404).json({ error: 'Order not found', id: orderId });
});

app.post('/orders', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { userId = 'user-42', items = [] } = req.body;
  const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  console.log(`[OrderService] Creating order ${orderId} for ${userId} with ${items.length} items`);

  try {
    // S-07: Injects 3s delay via SELECT pg_sleep(3) if items > 10
    await maybeInjectOrderDelay(items, db);

    // S-07: Every 30th request forces Redis cache miss / DB fallback
    await maybeInjectCacheMiss(userId, async () => {
      return { cartId: `cart-${userId}`, cached: true };
    });

    // Compute total
    const total = items.reduce((sum: number, item: OrderItem) => {
      return sum + (Number(item.price) || 29.99) * (Number(item.qty) || 1);
    }, 0);

    // Record order in database
    try {
      await db.query(
        'INSERT INTO orders (id, user_id, items, status, total) VALUES ($1, $2, $3, $4, $5)',
        [orderId, userId, JSON.stringify(items), 'pending', total]
      );
    } catch (dbErr: any) {
      console.warn('[OrderService] Failed to insert order into DB:', dbErr.message);
    }

    inMemoryOrders.push({
      id: orderId,
      userId,
      items,
      status: 'pending',
      total,
      createdAt: new Date().toISOString()
    });

    // Forward to Payment Service
    const paymentHeaders: Record<string, string> = {};
    if (req.headers['x-replay-mode']) paymentHeaders['x-replay-mode'] = req.headers['x-replay-mode'] as string;
    if (req.headers['x-simulate-slow']) paymentHeaders['x-simulate-slow'] = req.headers['x-simulate-slow'] as string;
    if (req.headers['x-simulate-503']) paymentHeaders['x-simulate-503'] = req.headers['x-simulate-503'] as string;
    if (req.headers.traceparent) paymentHeaders['traceparent'] = req.headers.traceparent as string;

    const paymentRes = await forwardPayment(orderId, total, paymentHeaders);

    const isPaid = paymentRes.statusCode === 200;
    const finalStatus = isPaid ? 'paid' : 'failed';

    // Update order status
    try {
      await db.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [finalStatus, orderId]);
    } catch (_) {}

    const orderRecord = inMemoryOrders.find(o => o.id === orderId);
    if (orderRecord) orderRecord.status = finalStatus;

    if (!isPaid) {
      return res.status(paymentRes.statusCode).json({
        orderId,
        status: 'failed',
        error: 'Payment processing failed',
        paymentDetails: paymentRes.data,
        durationMs: Date.now() - startTime
      });
    }

    return res.status(201).json({
      orderId,
      status: 'created',
      total,
      itemCount: items.length,
      payment: paymentRes.data,
      durationMs: Date.now() - startTime
    });
  } catch (err: any) {
    console.error('[OrderService] Order processing error:', err.message);
    return res.status(500).json({
      error: 'Order processing failed',
      message: err.message,
      durationMs: Date.now() - startTime
    });
  }
});

app.listen(port, () => {
  console.log(`Order Service listening on port ${port}`);
});
