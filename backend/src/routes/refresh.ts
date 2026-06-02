import { Router } from 'express';
import { clearCache } from '../services/sync.js';

const router = Router();

/**
 * POST /api/refresh
 * Clears the optional SQLite cache so the next read re-fetches from The Graph.
 */
router.post('/', (_req, res, next) => {
  try {
    clearCache();
    res.json({ status: 'ok', clearedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;
