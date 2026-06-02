import type { CatalogEntry } from '../types';

interface Props {
  catalog: CatalogEntry[];
  selectedCasino: string;
  selectedChain: string;
  onChange: (casino: string, chain: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  subgraph: 'Subgraph',
  explorer: 'Explorer',
  dune:     'Dune',
  rpc:      'RPC',
};

const SOURCE_COLORS: Record<string, string> = {
  subgraph: 'bg-emerald-100 text-emerald-700',
  explorer: 'bg-blue-100 text-blue-700',
  dune:     'bg-orange-100 text-orange-700',
  rpc:      'bg-slate-100 text-slate-600',
};

export default function CasinoSelector({ catalog, selectedCasino, selectedChain, onChange }: Props) {
  const casinoIds = [...new Set(catalog.map((e) => e.casinoId))];

  const chainsForCasino = catalog
    .filter((e) => e.casinoId === selectedCasino)
    .map((e) => ({ chainId: e.chainId, chainName: e.chainName }));

  const selectedEntry = catalog.find(
    (e) => e.casinoId === selectedCasino && e.chainId === selectedChain
  );

  function handleCasinoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newCasino = e.target.value;
    const firstChain = catalog.find((c) => c.casinoId === newCasino)?.chainId ?? 'polygon';
    onChange(newCasino, firstChain);
  }

  function handleChainChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(selectedCasino, e.target.value);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="casino-select" className="text-sm font-medium text-slate-600">
            Casino
          </label>
          <select
            id="casino-select"
            value={selectedCasino}
            onChange={handleCasinoChange}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            {casinoIds.map((id) => {
              const entry = catalog.find((c) => c.casinoId === id);
              return (
                <option key={id} value={id}>
                  {entry?.casinoName ?? id}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="chain-select" className="text-sm font-medium text-slate-600">
            Chain
          </label>
          <select
            id="chain-select"
            value={selectedChain}
            onChange={handleChainChange}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            {chainsForCasino.map(({ chainId, chainName }) => (
              <option key={chainId} value={chainId}>
                {chainName}
              </option>
            ))}
          </select>
        </div>

        {selectedEntry && (
          <div className="flex items-center gap-1.5">
            {selectedEntry.sources.map((s) => (
              <span
                key={s}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[s] ?? 'bg-slate-100 text-slate-600'}`}
              >
                {SOURCE_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        )}
      </div>

      {selectedEntry?.note && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
          {selectedEntry.note}
        </p>
      )}
    </div>
  );
}
