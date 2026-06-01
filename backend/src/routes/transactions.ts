import { Router } from 'express';
import { getNormalizedBets } from '../services/sync';
import { parseDateRange, parseIntParam } from './util';

const router = Router();

/**
 * GET /api/transactions?startDate=&endDate=&limit=&offset=
 * Returns bets in the range, sorted by amount desc, paginated.
 */
router.get('/', async (req, res, next) => {
  try {
    const { fromTs, toTs } = parseDateRange(req);
    const limit = parseIntParam(req.query.limit, 100);
    const offset = parseIntParam(req.query.offset, 0);

    const all = await getNormalizedBets(fromTs, toTs);
    all.sort((a, b) => b.amount_usd - a.amount_usd);

    const data = all.slice(offset, offset + limit);
    res.json({ data, total: all.length, limit, offset });
  } catch (err) {
    next(err);
  }
});

export default router;
