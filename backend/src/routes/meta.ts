import { Router } from 'express';
import { fetchDataDateRange } from '../adapters/graph';

const router = Router();

/**
 * GET /api/meta
 * Returns the date span (ISO strings) of data available in the subgraph, so the
 * frontend can default its range to a window that actually contains data.
 */
router.get('/', async (_req, res, next) => {
  try {
    const range = await fetchDataDateRange();
    if (!range) {
      res.json({ minDate: null, maxDate: null });
      return;
    }
    res.json({
      minDate: new Date(range.minDate * 1000).toISOString().slice(0, 10),
      maxDate: new Date(range.maxDate * 1000).toISOString().slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
