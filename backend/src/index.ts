import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db/client.js';

import transactionsRoute from './routes/transactions.js';
import summaryRoute from './routes/summary.js';
import dailyBreakdownRoute from './routes/dailyBreakdown.js';
import refreshRoute from './routes/refresh.js';
import exportCsvRoute from './routes/exportCsv.js';
import metaRoute from './routes/meta.js';
import catalogRoute from './routes/catalog.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/catalog', catalogRoute);
app.use('/api/meta', metaRoute);
app.use('/api/transactions', transactionsRoute);
app.use('/api/summary', summaryRoute);
app.use('/api/daily-breakdown', dailyBreakdownRoute);
app.use('/api/refresh', refreshRoute);
app.use('/api/export/csv', exportCsvRoute);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const message = err.message || 'Internal server error';
  console.error('[error]', message);

  if (/GRAPH_API_KEY/.test(message)) {
    res.status(500).json({ error: message });
    return;
  }
  if (/Unknown casino|Unknown chain|No adapter registered/.test(message)) {
    res.status(400).json({ error: message });
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
    console.warn('WARNING: GRAPH_API_KEY is not set');
  }
});
