import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const port = process.env.PORT || 4002;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

app.use(express.static(path.join(__dirname, '../public')));

app.get('/config.js', (req: Request, res: Response) => {
  res.type('application/javascript');
  res.send(`window.API_GATEWAY_URL = "${API_GATEWAY_URL}";`);
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'demo-frontend', port });
});

app.listen(port, () => {
  console.log(`Demo E-Commerce Frontend listening on http://localhost:${port}`);
});
