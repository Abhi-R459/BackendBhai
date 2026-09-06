import express, { Request, Response } from 'express';
import http from 'http';

const app = express();
const port = process.env.PORT || 3000;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3002';

app.use(express.json());

// Enable CORS for demo frontend & amazon store
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Replay-Mode, X-Simulate-Slow, X-Simulate-503, traceparent');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Centralized Chaos State Store
export interface ChaosState {
  mode: 'normal' | 'heavy' | 'invalid-auth' | 'slow-payment' | 'payment-503' | 'random';
  description: string;
  lastUpdated: string;
}

let activeChaosState: ChaosState = {
  mode: 'normal',
  description: 'Normal Happy Path (instant ~200ms checkout)',
  lastUpdated: new Date().toISOString()
};

// Helper for traceparent propagation
function getForwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (req.headers.authorization) {
    headers['authorization'] = req.headers.authorization as string;
  }
  if (req.headers.traceparent) {
    headers['traceparent'] = req.headers.traceparent as string;
  }
  if (req.headers['x-replay-mode']) {
    headers['x-replay-mode'] = req.headers['x-replay-mode'] as string;
  }
  if (req.headers['x-simulate-slow']) {
    headers['x-simulate-slow'] = req.headers['x-simulate-slow'] as string;
  }
  if (req.headers['x-simulate-503']) {
    headers['x-simulate-503'] = req.headers['x-simulate-503'] as string;
  }
  return headers;
}

// Simple HTTP client using native Node http
function forwardRequest(urlStr: string, method: string, headers: Record<string, string>, body?: any): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers
    };

    const req = http.request(options, (res) => {
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
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// GET /api/chaos-state
app.get('/api/chaos-state', (req: Request, res: Response) => {
  res.json(activeChaosState);
});

// POST /api/chaos-state
app.post('/api/chaos-state', (req: Request, res: Response) => {
  const { mode = 'normal' } = req.body;
  let description = 'Normal Happy Path (instant ~200ms checkout)';
  if (mode === 'heavy') description = 'Heavy Order (>10 items → 3s DB delay via SELECT pg_sleep)';
  if (mode === 'invalid-auth') description = 'Auth Timeout (invalid token → 5s timeout & 401 error)';
  if (mode === 'slow-payment') description = 'Slow Payment Provider (5s external gateway delay)';
  if (mode === 'payment-503') description = 'Payment Provider 503 (gateway temporarily unavailable)';
  if (mode === 'random') description = 'Random Real-World Chaos (intermittent delays and errors)';

  activeChaosState = {
    mode,
    description,
    lastUpdated: new Date().toISOString()
  };
  console.log(`[APIGateway] Global Chaos State updated to [${mode}]: ${description}`);
  res.json({ success: true, chaosState: activeChaosState });
});

// GET /api/products
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const result = await forwardRequest(`${ORDER_SERVICE_URL}/products`, 'GET', getForwardHeaders(req));
    res.status(result.statusCode).json(result.data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to fetch products from order service', message: err.message });
  }
});

// GET /api/orders
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const result = await forwardRequest(`${ORDER_SERVICE_URL}/orders`, 'GET', getForwardHeaders(req));
    res.status(result.statusCode).json(result.data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to fetch orders from order service', message: err.message });
  }
});

// GET /api/orders/:id
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const result = await forwardRequest(`${ORDER_SERVICE_URL}/orders/${req.params.id}`, 'GET', getForwardHeaders(req));
    res.status(result.statusCode).json(result.data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to fetch order', message: err.message });
  }
});

// POST /api/orders (Checkout request flow with dynamic chaos state injection)
app.post('/api/orders', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[APIGateway] Processing POST /api/orders (Active Chaos Mode: ${activeChaosState.mode})`);

  try {
    const authHeaders = getForwardHeaders(req);
    const orderHeaders = getForwardHeaders(req);
    let orderBody = { ...req.body };

    // Apply active chaos state if request did not specify manual overrides
    if (activeChaosState.mode === 'invalid-auth') {
      authHeaders['authorization'] = 'Bearer invalid';
    } else if (!authHeaders['authorization']) {
      authHeaders['authorization'] = 'Bearer token-user-42';
    }

    if (activeChaosState.mode === 'heavy') {
      // Force heavy items payload (> 10 items) to trigger 3s DB delay
      if (!orderBody.items || orderBody.items.length <= 10) {
        orderBody.items = [];
        for (let i = 1; i <= 12; i++) {
          orderBody.items.push({ id: `item-${i}`, name: `Bulk Hardware Package #${i}`, qty: 1, price: 19.99 });
        }
      }
    } else if (activeChaosState.mode === 'slow-payment') {
      orderHeaders['x-simulate-slow'] = 'true';
    } else if (activeChaosState.mode === 'payment-503') {
      orderHeaders['x-simulate-503'] = 'true';
    } else if (activeChaosState.mode === 'random') {
      // 30% slow, 10% 503
      const rand = Math.random();
      if (rand < 0.10) {
        orderHeaders['x-simulate-503'] = 'true';
      } else if (rand < 0.40) {
        orderHeaders['x-simulate-slow'] = 'true';
      }
    }

    // 1. Authenticate with Auth Service
    const authResult = await forwardRequest(`${AUTH_SERVICE_URL}/auth/verify`, 'POST', authHeaders, {
      token: authHeaders['authorization']
    });

    if (authResult.statusCode !== 200) {
      return res.status(authResult.statusCode).json({
        error: 'Authentication failed',
        details: authResult.data,
        activeChaosMode: activeChaosState.mode,
        durationMs: Date.now() - startTime
      });
    }

    // 2. Forward to Order Service
    const orderResult = await forwardRequest(`${ORDER_SERVICE_URL}/orders`, 'POST', orderHeaders, orderBody);

    return res.status(orderResult.statusCode).json({
      ...orderResult.data,
      activeChaosMode: activeChaosState.mode,
      gatewayDurationMs: Date.now() - startTime
    });
  } catch (err: any) {
    console.error('[APIGateway] Error handling /api/orders:', err.message);
    return res.status(500).json({
      error: 'Gateway routing failure',
      message: err.message,
      activeChaosMode: activeChaosState.mode,
      durationMs: Date.now() - startTime
    });
  }
});

app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
