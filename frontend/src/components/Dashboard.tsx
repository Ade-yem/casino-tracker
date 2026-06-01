import { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import type { Bet, DailyBreakdown, SummaryMetrics } from '../types';
import { fetchSummary, fetchDailyBreakdown, fetchTransactions } from '../api/client';
import SummaryCards from './SummaryCards';
import TransactionChart from './TransactionChart';
import TransactionTable from './TransactionTable';
import DateRangeSelector from './DateRangeSelector';
import ExportButton from './ExportButton';

const ISO = 'yyyy-MM-dd';

export default function Dashboard() {
  const [start, setStart] = useState(format(subDays(new Date(), 30), ISO));
  const [end, setEnd] = useState(format(new Date(), ISO));

  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [daily, setDaily] = useState<DailyBreakdown[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSummary(start, end),
      fetchDailyBreakdown(start, end),
      fetchTransactions({ startDate: start, endDate: end, limit: 1000 }),
    ])
      .then(([s, d, t]) => {
        if (cancelled) return;
        setSummary(s);
        setDaily(d);
        setBets(t.data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const onRangeChange = (s: string, e: string) => {
    setStart(s);
    setEnd(e);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">BetSwirl Wallet Tracker</h1>
          <p className="text-sm text-slate-500">
            On-chain cash-flow analysis for BetSwirl on Polygon, via The Graph
          </p>
        </div>
        <ExportButton start={start} end={end} />
      </header>

      <DateRangeSelector start={start} end={end} onRangeChange={onRangeChange} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {summary && <SummaryCards metrics={summary} />}
      <TransactionChart daily={daily} />
      <TransactionTable bets={bets} />
    </main>
  );
}
