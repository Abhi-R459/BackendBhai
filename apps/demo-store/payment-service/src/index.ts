import express, { Request, Response } from 'express';
import http from 'http';

const app = express();
const port = process.env.PORT || 3003;

const MOCK_PAYMENT_URL = process.env.MOCK_PAYMENT_URL || 'http://localhost:4000';

app.use(express.json());

function callMockPayment(amount: number, headers: Record<string, string>): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${MOCK_PAYMENT_URL}/charges`);
    const payload = JSON.stringify({
      amount: Math.round(amount * 100),
      currency: 'usd'
    });

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
  res.json({ status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.post('/payments', async (req: Request, res: Response) => {
  const { orderId, amount = 100 } = req.body;
  console.log(`[PaymentService] Processing payment for order ${orderId}, amount: $${amount}`);

  const forwardHeaders: Record<string, string> = {};
  if (req.headers['x-replay-mode']) forwardHeaders['x-replay-mode'] = req.headers['x-replay-mode'] as string;
  if (req.headers['x-simulate-slow']) forwardHeaders['x-simulate-slow'] = req.headers['x-simulate-slow'] as string;
  if (req.headers['x-simulate-503']) forwardHeaders['x-simulate-503'] = req.headers['x-simulate-503'] as string;
  if (req.headers.traceparent) forwardHeaders['traceparent'] = req.headers.traceparent as string;

  try {
    const chargeRes = await callMockPayment(amount, forwardHeaders);

    if (chargeRes.statusCode !== 200) {
      console.warn(`[PaymentService] Mock payment provider returned status ${chargeRes.statusCode}`);
      return res.status(chargeRes.statusCode).json({
        orderId,
        status: 'failed',
        error: 'Charge declined by provider',
        details: chargeRes.data
      });
    }

    const paymentId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    return res.status(200).json({
      paymentId,
      orderId,
      status: 'completed',
      amount,
      provider: 'mock-payment',
      charge: chargeRes.data
    });
  } catch (err: any) {
    console.error('[PaymentService] Error calling payment provider:', err.message);
    return res.status(502).json({
      orderId,
      status: 'failed',
      error: 'Payment provider unavailable',
      message: err.message
    });
  }
});

app.listen(port, () => {
  console.log(`Payment Service listening on port ${port}`);
});
