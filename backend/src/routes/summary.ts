import { Router } from 'express';
import { getSummary, getBankSummary } from '../services/aggregator';
import { parseDateRange } from './util';

const router = Router();

/**
 * GET /api/summary?startDate=&endDate=
 * Date-filtered summary from individual bets.
 * With ?allTime=true uses the Bank entity for a fast cumulative view.
 */
router.get('/', async (req, res, next) => {
  try {
    if (req.query.allTime === 'true') {
      res.json(await getBankSummary());
      return;
    }
    const { fromTs, toTs } = parseDateRange(req);
    res.json(await getSummary(fromTs, toTs));
  } catch (err) {
    next(err);
  }
});

export default router;
