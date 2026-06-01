import { Router } from 'express';
import { getNormalizedBets } from '../services/sync';
import { parseDateRange } from './util';

const router = Router();

/** Escape a CSV field per RFC 4180 (quote if it contains comma, quote, or newline). */
function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** GET /api/export/csv?startDate=&endDate=  — stream all bets as CSV. */
router.get('/', async (req, res, next) => {
  try {
    const { fromTs, toTs } = parseDateRange(req);
    const bets = await getNormalizedBets(fromTs, toTs);
    bets.sort((a, b) => a.timestamp - b.timestamp);

    const headers = [
      'id',
      'timestamp_utc',
      'bettor',
      'game_type',
      'status',
      'token',
      'bet_amount',
      'payout',
      'roll_tx_hash',
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="betswirl-bets-${fromTs}-${toTs}.csv"`
    );

    res.write(headers.join(',') + '\n');
    for (const b of bets) {
      const row = [
        csvField(b.id),
        csvField(new Date(b.timestamp * 1000).toISOString()),
        csvField(b.bettor),
        csvField(b.game_type),
        csvField(b.status),
        csvField(b.token),
        csvField(b.amount_usd),
        csvField(b.payout_usd),
        csvField(b.roll_tx_hash),
      ];
      res.write(row.join(',') + '\n');
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
