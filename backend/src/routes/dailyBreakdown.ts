import { Router } from 'express';
import { getDailyBreakdown } from '../services/aggregator';
import { parseDateRange } from './util';

const router = Router();

/** GET /api/daily-breakdown?startDate=&endDate=  — per-day inflow/outflow/net. */
router.get('/', async (req, res, next) => {
  try {
    const { fromTs, toTs } = parseDateRange(req);
    res.json(await getDailyBreakdown(fromTs, toTs));
  } catch (err) {
    next(err);
  }
});

export default router;
