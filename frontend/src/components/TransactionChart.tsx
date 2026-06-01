import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { DailyBreakdown } from '../types';
import { formatUsd } from '../lib/format';

interface Props {
  daily: DailyBreakdown[];
}

type Tab = 'daily' | 'cumulative';

const COLORS = { inflow: '#22c55e', outflow: '#ef4444', net: '#3b82f6' };

export default function TransactionChart({ daily }: Props) {
  const [tab, setTab] = useState<Tab>('daily');

  const cumulative = useMemo(() => {
    let running = 0;
    return daily.map((d) => {
      running += d.net;
      return { date: d.date, cumulativeNet: running };
    });
  }, [daily]);

  const tabBtn = (id: Tab) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      tab === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Flow Over Time</h2>
        <div className="flex gap-2">
          <button className={tabBtn('daily')} onClick={() => setTab('daily')}>
            Daily Flow
          </button>
          <button className={tabBtn('cumulative')} onClick={() => setTab('cumulative')}>
            Cumulative Net
          </button>
        </div>
      </div>

      {daily.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-slate-400">
          No data for this range
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          {tab === 'daily' ? (
            <BarChart data={daily} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatUsd(v)} width={80} />
              <Tooltip formatter={(v: number) => formatUsd(v, true)} />
              <Legend />
              <Bar dataKey="inflow" name="Inflow" fill={COLORS.inflow} />
              <Bar dataKey="outflow" name="Outflow" fill={COLORS.outflow} />
            </BarChart>
          ) : (
            <LineChart data={cumulative} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatUsd(v)} width={80} />
              <Tooltip formatter={(v: number) => formatUsd(v, true)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="cumulativeNet"
                name="Cumulative Net"
                stroke={COLORS.net}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </section>
  );
}
