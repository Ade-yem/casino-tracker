import { useEffect, useState } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import type { Bet, DailyBreakdown, SummaryMetrics, CatalogEntry } from '../types';
import {
  fetchSummary,
  fetchDailyBreakdown,
  fetchTransactions,
  fetchDataRange,
  fetchCatalog,
} from '../api/client';
import SummaryCards from './SummaryCards';
import TransactionChart from './TransactionChart';
import TransactionTable from './TransactionTable';
import DateRangeSelector from './DateRangeSelector';
import ExportButton from './ExportButton';
import CasinoSelector from './CasinoSelector';

const ISO = 'yyyy-MM-dd';

export default function Dashboard() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [casino, setCasino] = useState('betswirl');
  const [chain, setChain] = useState('polygon');

  const [start, setStart] = useState(format(subDays(new Date(), 30), ISO));
  const [end, setEnd] = useState(format(new Date(), ISO));

  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [daily, setDaily] = useState<DailyBreakdown[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load catalog on mount
  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(() => {});
  }, []);

  // When casino/chain changes, snap the date range to that chain's actual data.
  useEffect(() => {
    let cancelled = false;
    fetchDataRange({ casino, chain })
      .then((r) => {
        if (cancelled || !r.maxDate) return;
        const max = parseISO(r.maxDate);
        const desiredStart = format(subDays(max, 30), ISO);
        const min = r.minDate ?? desiredStart;
        setStart(desiredStart < min ? min : desiredStart);
        setEnd(r.maxDate);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [casino, chain]);

  // Reload data when date range or casino/chain changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const cc = { casino, chain };

    Promise.all([
      fetchSummary(start, end, cc),
      fetchDailyBreakdown(start, end, cc),
      fetchTransactions({ startDate: start, endDate: end, limit: 1000, ...cc }),
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

    return () => { cancelled = true; };
  }, [start, end, casino, chain]);

  function onCasinoChainChange(newCasino: string, newChain: string) {
    setCasino(newCasino);
    setChain(newChain);
  }

  const onRangeChange = (s: string, e: string) => {
    setStart(s);
    setEnd(e);
  };

  const currentEntry = catalog.find((e) => e.casinoId === casino && e.chainId === chain);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {currentEntry ? `${currentEntry.casinoName} on ${currentEntry.chainName}` : 'Casino Wallet Tracker'}
          </h1>
          <p className="text-sm text-slate-500">
            On-chain cash-flow analytics via The Graph
          </p>
        </div>
        <ExportButton start={start} end={end} casino={casino} chain={chain} />
      </header>

      <div className="flex flex-wrap items-center gap-6">
        {catalog.length > 0 && (
          <CasinoSelector
            catalog={catalog}
            selectedCasino={casino}
            selectedChain={chain}
            onChange={onCasinoChainChange}
          />
        )}
        <DateRangeSelector start={start} end={end} onRangeChange={onRangeChange} />
      </div>

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
