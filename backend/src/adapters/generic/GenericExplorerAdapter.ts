import { ExplorerClient } from '../../sources/explorer.js';
import type { CasinoAdapter } from '../CasinoAdapter.js';
import type {
  NormalizedBet,
  SummaryMetrics,
  DailyBreakdown,
  DateRange,
} from '../../domain/types.js';
import { Capability } from '../../domain/types.js';

export interface TrackedToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface GenericExplorerConfig {
  casinoId: string;
  chainId: string;
  /** House wallet addresses to track — inflows to, outflows from. */
  houseAddresses: string[];
  /** Tokens to track (ERC-20). */
  trackedTokens: TrackedToken[];
  explorerClient: ExplorerClient;
}

/**
 * Reusable adapter for any casino defined by house wallet addresses + tokens.
 *
 * Capability: inflow/outflow/net only. No game-level data, no payout ratio.
 * Inflow  = ERC-20 transfers TO a house address (player wagers).
 * Outflow = ERC-20 transfers FROM a house address (player payouts).
 */
export class GenericExplorerAdapter implements CasinoAdapter {
  readonly casinoId: string;
  readonly chainId: string;
  readonly capabilities = new Set<Capability>([
    Capability.BET_HISTORY,
    Capability.DAILY_AGGREGATES,
    Capability.ALL_TIME_SUMMARY,
  ]);

  private readonly cfg: GenericExplorerConfig;

  constructor(cfg: GenericExplorerConfig) {
    this.casinoId = cfg.casinoId;
    this.chainId = cfg.chainId;
    this.cfg = cfg;
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getBets
  // -------------------------------------------------------------------------

  async getBets(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
    const txs = await this.fetchTransfers(fromTs, toTs);
    return txs;
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getSummary
  // -------------------------------------------------------------------------

  async getSummary(fromTs: number, toTs: number): Promise<SummaryMetrics> {
    const bets = await this.getBets(fromTs, toTs);
    return this.toMetrics(bets);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getAllTimeSummary
  // -------------------------------------------------------------------------

  async getAllTimeSummary(): Promise<SummaryMetrics> {
    // Explorer pagination is expensive — fetch all-time via a very wide window
    const epochStart = 0;
    const now = Math.floor(Date.now() / 1000);
    return this.getSummary(epochStart, now);
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDailyBreakdown
  // -------------------------------------------------------------------------

  async getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
    const bets = await this.getBets(fromTs, toTs);
    const byDate = new Map<string, DailyBreakdown>();

    for (const b of bets) {
      const date = new Date(b.timestamp * 1000).toISOString().slice(0, 10);
      const existing = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
      byDate.set(date, {
        date,
        inflow: existing.inflow + b.amount_usd,
        outflow: existing.outflow + b.payout_usd,
        net: existing.net + (b.amount_usd - b.payout_usd),
      });
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  // -------------------------------------------------------------------------
  // CasinoAdapter: getDateRange — not supported (no aggregates to query)
  // -------------------------------------------------------------------------

  async getDateRange(): Promise<DateRange | null> {
    return null;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async fetchTransfers(fromTs: number, toTs: number): Promise<NormalizedBet[]> {
    const normalizedHouses = this.cfg.houseAddresses.map((a) => a.toLowerCase());
    const results: NormalizedBet[] = [];

    for (const token of this.cfg.trackedTokens) {
      for (const house of this.cfg.houseAddresses) {
        // Fetch all ERC-20 token transfers involving this house wallet
        const txs = await this.paginateTokenTx(house, token);

        for (const tx of txs) {
          const ts = Number(tx.timeStamp);
          if (ts < fromTs || ts > toTs) continue;
          if (tx.isError === '1') continue;

          const decimals = Number(tx.tokenDecimal ?? token.decimals);
          const amount = Number(tx.value) / 10 ** decimals;
          const toAddr = (tx.to ?? '').toLowerCase();
          const fromAddr = (tx.from ?? '').toLowerCase();

          const isInflow = normalizedHouses.includes(toAddr);
          const isOutflow = normalizedHouses.includes(fromAddr) && !normalizedHouses.includes(toAddr);

          if (!isInflow && !isOutflow) continue;

          results.push({
            id: `${tx.hash}-${tx.from}-${tx.to}`,
            bettor: isInflow ? fromAddr : toAddr,
            amount_usd: isInflow ? amount : 0,
            payout_usd: isOutflow ? amount : 0,
            token: tx.tokenSymbol ?? token.symbol,
            game_type: 'transfer',
            resolved: true,
            refunded: false,
            bet_tx_hash: tx.hash,
            roll_tx_hash: null,
            timestamp: ts,
            casino: this.casinoId,
            chain: this.chainId,
          });
        }
      }
    }

    // Sort by timestamp, deduplicate by hash
    const seen = new Set<string>();
    return results
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((r) => {
        if (seen.has(r.bet_tx_hash)) return false;
        seen.add(r.bet_tx_hash);
        return true;
      });
  }

  private async paginateTokenTx(
    address: string,
    token: TrackedToken
  ) {
    const PAGE = 1000;
    const all = [];
    let page = 1;

    while (true) {
      const rows = await this.cfg.explorerClient.getTokenTransfers({
        address,
        page,
        offset: PAGE,
      });
      // Filter by token contract address when specified
      const filtered = token.address
        ? rows.filter((r) => (r.contractAddress ?? '').toLowerCase() === token.address.toLowerCase())
        : rows;
      all.push(...filtered);
      if (rows.length < PAGE) break;
      page++;
    }
    return all;
  }

  private toMetrics(bets: NormalizedBet[]): SummaryMetrics {
    let inflows = 0, outflows = 0;
    for (const b of bets) {
      inflows += b.amount_usd;
      outflows += b.payout_usd;
    }
    return {
      totalInflows: inflows,
      totalOutflows: outflows,
      netPosition: inflows - outflows,
      payoutRatio: inflows === 0 ? 0 : outflows / inflows,
      txCount: bets.length,
    };
  }
}
