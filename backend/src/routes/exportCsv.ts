import { Router } from 'express';
import { parseDateRange, parseAdapter } from './util.js';

const router = Router();

function csvField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/export/csv?startDate=&endDate=&casino=betswirl&chain=polygon
 */
router.get('/', async (req, res, next) => {
  try {
    const adapter = parseAdapter(req);
    const { fromTs, toTs } = parseDateRange(req);
    const bets = await adapter.getBets(fromTs, toTs);
    bets.sort((a, b) => a.timestamp - b.timestamp);

    const casinoId = adapter.casinoId;
    const chainId = adapter.chainId;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${casinoId}-${chainId}-bets-${fromTs}-${toTs}.csv"`
    );

    const headers = [
      'id', 'timestamp_utc', 'bettor', 'casino', 'chain', 'game_type',
      'resolved', 'refunded', 'token', 'bet_amount', 'payout', 'roll_tx_hash',
    ];
    res.write(headers.join(',') + '\n');

    for (const b of bets) {
      const row = [
        csvField(b.id),
        csvField(new Date(b.timestamp * 1000).toISOString()),
        csvField(b.bettor),
        csvField(b.casino),
        csvField(b.chain),
        csvField(b.game_type),
        csvField(String(b.resolved)),
        csvField(String(b.refunded)),
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
