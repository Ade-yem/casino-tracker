import { useMemo, useState } from 'react';
import type { Bet } from '../types';
import { formatUsd, shortHash, formatDate } from '../lib/format';

interface Props {
  bets: Bet[];
}

type StatusFilter = 'All' | 'Win' | 'Lose' | 'Pending';
const PAGE_SIZE = 25;

export default function TransactionTable({ bets }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [gameFilter, setGameFilter] = useState<string>('All');
  const [page, setPage] = useState(0);

  const gameTypes = useMemo(
    () => ['All', ...Array.from(new Set(bets.map((b) => b.game_type))).sort()],
    [bets]
  );

  const filtered = useMemo(() => {
    let rows = bets;
    if (statusFilter !== 'All') rows = rows.filter((b) => b.status === statusFilter);
    if (gameFilter !== 'All') rows = rows.filter((b) => b.game_type === gameFilter);
    return [...rows].sort((a, b) => b.amount_usd - a.amount_usd);
  }, [bets, statusFilter, gameFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const statusBadge = (s: Bet['status']) => {
    const cls =
      s === 'Win'
        ? 'bg-green-100 text-green-700'
        : s === 'Lose'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700';
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>;
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Bets</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(0);
            }}
          >
            {(['All', 'Win', 'Lose', 'Pending'] as StatusFilter[]).map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={gameFilter}
            onChange={(e) => {
              setGameFilter(e.target.value);
              setPage(0);
            }}
          >
            {gameTypes.map((g) => (
              <option key={g} value={g}>
                {g === 'All' ? 'All games' : g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-slate-400">No bets to show</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Tx Hash</th>
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Token</th>
                  <th className="py-2 pr-4 text-right">Bet</th>
                  <th className="py-2 pr-4 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-4 whitespace-nowrap text-slate-600">
                      {formatDate(b.timestamp)}
                    </td>
                    <td className="py-2 pr-4">
                      {b.roll_tx_hash ? (
                        <a
                          className="text-blue-600 hover:underline"
                          href={`https://polygonscan.com/tx/${b.roll_tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortHash(b.roll_tx_hash)}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-4">{b.game_type}</td>
                    <td className="py-2 pr-4">{statusBadge(b.status)}</td>
                    <td className="py-2 pr-4">{b.token}</td>
                    <td className="py-2 pr-4 text-right font-medium">
                      {formatUsd(b.amount_usd, true)}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-green-600">
                      {b.payout_usd > 0 ? formatUsd(b.payout_usd, true) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              {filtered.length.toLocaleString()} bets · page {safePage + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                Prev
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
