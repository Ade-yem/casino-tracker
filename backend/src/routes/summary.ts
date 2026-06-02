import { Router } from 'express';
import { parseDateRange, parseAdapter } from './util.js';

const router = Router();

/**
 * GET /api/summary?startDate=&endDate=&allTime=true&casino=betswirl&chain=polygon
 */
router.get('/', async (req, res, next) => {
  try {
    const adapter = parseAdapter(req);
    if (req.query.allTime === 'true') {
      res.json(await adapter.getAllTimeSummary());
      return;
    }
    const { fromTs, toTs } = parseDateRange(req);
    res.json(await adapter.getSummary(fromTs, toTs));
  } catch (err) {
    next(err);
  }
});

export default router;
