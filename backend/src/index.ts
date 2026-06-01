import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb } from './db/client';

import transactionsRoute from './routes/transactions';
import summaryRoute from './routes/summary';
import dailyBreakdownRoute from './routes/dailyBreakdown';
import refreshRoute from './routes/refresh';
import exportCsvRoute from './routes/exportCsv';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/transactions', transactionsRoute);
app.use('/api/summary', summaryRoute);
app.use('/api/daily-breakdown', dailyBreakdownRoute);
app.use('/api/refresh', refreshRoute);
app.use('/api/export/csv', exportCsvRoute);

// Centralized error handler — maps known failure modes to useful status codes.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const message = err.message || 'Internal server error';
  console.error('[error]', message);

  if (/GRAPH_API_KEY|CASINO_STORE_ADDRESS/.test(message)) {
    res.status(500).json({ error: message });
    return;
  }
  if (/timeout|ETIMEDOUT|ECONNABORTED|ENOTFOUND|socket hang up/i.test(message)) {
    res.status(503).json({ error: 'The Graph is unreachable or slow. Retry shortly.', detail: message });
    return;
  }
  res.status(500).json({ error: message });
});

initDb();
app.listen(config.port, () => {
  console.log(`Backend running on :${config.port}`);
  if (!config.graphApiKey) {
    console.warn('WARNING: GRAPH_API_KEY is not set — data endpoints will return 500 until it is configured in backend/.env');
  }
});
