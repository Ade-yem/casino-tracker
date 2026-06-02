import { Router } from 'express';
import { parseDateRange, parseAdapter } from './util.js';

const router = Router();

/**
 * GET /api/daily-breakdown?startDate=&endDate=&casino=betswirl&chain=polygon
 */
router.get('/', async (req, res, next) => {
  try {
    const adapter = parseAdapter(req);
    const { fromTs, toTs } = parseDateRange(req);
    res.json(await adapter.getDailyBreakdown(fromTs, toTs));
  } catch (err) {
    next(err);
  }
});

export default router;
