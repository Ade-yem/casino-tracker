import type { SummaryMetrics } from '../types';
import { formatUsd, formatPercent } from '../lib/format';

interface Props {
  metrics: SummaryMetrics;
  /** Hide the payout ratio card for explorer-based casinos (no game-level resolution data). */
  hidePayoutRatio?: boolean;
}

interface CardProps {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}

function Card({ label, value, accent, sub }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function SummaryCards({ metrics, hidePayoutRatio = false }: Props) {
  const netPositive = metrics.netPosition >= 0;
  const cols = hidePayoutRatio
    ? 'grid-cols-1 sm:grid-cols-3'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return (
    <div className={`grid gap-4 ${cols}`}>
      <Card
        label="Total Inflows"
        value={formatUsd(metrics.totalInflows)}
        accent="text-green-600"
        sub="Player stakes received"
      />
      <Card
        label="Total Outflows"
        value={formatUsd(metrics.totalOutflows)}
        accent="text-red-600"
        sub="Payouts to players"
      />
      <Card
        label="Net Position"
        value={formatUsd(metrics.netPosition)}
        accent={netPositive ? 'text-green-600' : 'text-red-600'}
        sub={netPositive ? 'House profit' : 'House loss'}
      />
      {!hidePayoutRatio && (
        <Card
          label="Payout Ratio"
          value={formatPercent(metrics.payoutRatio)}
          accent="text-blue-600"
          sub={`${metrics.txCount.toLocaleString()} resolved bets`}
        />
      )}
    </div>
  );
}
