import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

let requestCounter = 0;

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'mock-payment-api' });
});

app.post('/charges', async (req: Request, res: Response) => {
  requestCounter++;
  const currentCount = requestCounter;
  const replayMode = req.headers['x-replay-mode'] === 'deterministic';
  const forceSlow = req.headers['x-simulate-slow'] === 'true';
  const force503 = req.headers['x-simulate-503'] === 'true';

  console.log(`[MockPaymentAPI] Request #${currentCount}: POST /charges (replayMode=${replayMode})`);

  // 1. Deterministic Replay Mode (forces instant 200 success)
  if (replayMode) {
    return res.status(200).json({
      id: `ch_mock_success_${Date.now()}`,
      status: 'succeeded',
      amount: req.body.amount || 1000,
      currency: req.body.currency || 'usd',
      paid: true,
      mode: 'deterministic-replay'
    });
  }

  // 2. Failure: 5% of requests / every 20th request or forced
  if (force503 || currentCount % 20 === 0) {
    console.warn(`[MockPaymentAPI] Injecting 503 Service Unavailable for request #${currentCount}`);
    return res.status(503).json({
      error: {
        code: 'service_unavailable',
        message: 'Payment gateway temporarily unavailable (503)',
        status: 503
      }
    });
  }

  // 3. Slow payment: 30% of requests (e.g. counter % 10 in [1, 2, 3] or random < 0.3) or forced
  // We use a deterministic distribution pattern (3 out of every 10) so tests and demos are predictable
  const isSlow = forceSlow || (currentCount % 10 === 3 || currentCount % 10 === 6 || currentCount % 10 === 9);

  if (isSlow) {
    console.log(`[MockPaymentAPI] Injecting 5000ms delay for request #${currentCount}...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    return res.status(200).json({
      id: `ch_mock_delayed_${Date.now()}`,
      status: 'succeeded',
      amount: req.body.amount || 1000,
      currency: req.body.currency || 'usd',
      paid: true,
      delayed: true,
      delayMs: 5000
    });
  }

  // 4. Normal fast success (65% of requests)
  return res.status(200).json({
    id: `ch_mock_success_${Date.now()}`,
    status: 'succeeded',
    amount: req.body.amount || 1000,
    currency: req.body.currency || 'usd',
    paid: true
  });
});

app.listen(port, () => {
  console.log(`Mock Payment API server listening on port ${port}`);
});
