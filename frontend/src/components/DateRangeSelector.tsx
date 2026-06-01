import { format, subDays } from 'date-fns';

interface Props {
  start: string;
  end: string;
  onRangeChange: (start: string, end: string) => void;
}

const ISO = 'yyyy-MM-dd';

export default function DateRangeSelector({ start, end, onRangeChange }: Props) {
  const applyPreset = (days: number) => {
    const today = new Date();
    onRangeChange(format(subDays(today, days), ISO), format(today, ISO));
  };

  const presetBtn =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-slate-500">Start</label>
        <input
          type="date"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={start}
          max={end}
          onChange={(e) => onRangeChange(e.target.value, end)}
        />
      </div>
      <div className="flex flex-col">
        <label className="mb-1 text-xs font-medium text-slate-500">End</label>
        <input
          type="date"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={end}
          min={start}
          onChange={(e) => onRangeChange(start, e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <button className={presetBtn} onClick={() => applyPreset(7)}>
          Last 7 days
        </button>
        <button className={presetBtn} onClick={() => applyPreset(30)}>
          Last 30 days
        </button>
        <button className={presetBtn} onClick={() => applyPreset(90)}>
          Last 90 days
        </button>
      </div>
    </div>
  );
}
