import { Router } from 'express';
import { getSummary, getAllTimeSummary } from '../services/aggregator';
import { parseDateRange } from './util';

const router = Router();

/**
 * GET /api/summary?startDate=&endDate=
 * Date-filtered summary derived from pre-aggregated daily data.
 * With ?allTime=true aggregates the Token entities for a cumulative view.
 */
router.get('/', async (req, res, next) => {
  try {
    if (req.query.allTime === 'true') {
      res.json(await getAllTimeSummary());
      return;
    }
    const { fromTs, toTs } = parseDateRange(req);
    res.json(await getSummary(fromTs, toTs));
  } catch (err) {
    next(err);
  }
});

export default router;
