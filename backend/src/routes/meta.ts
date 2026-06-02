import { Router } from 'express';
import { parseAdapter } from './util.js';

const router = Router();

/**
 * GET /api/meta?casino=betswirl&chain=polygon
 * Returns the date span (ISO strings) of data available for the selected
 * casino+chain, so the frontend can default its range to real data.
 */
router.get('/', async (req, res, next) => {
  try {
    const adapter = parseAdapter(req);
    const range = await adapter.getDateRange();
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
