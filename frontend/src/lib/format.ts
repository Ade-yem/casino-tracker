const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsd(n: number, precise = false): string {
  return precise ? usdPrecise.format(n) : usd.format(n);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function shortHash(hash: string | null): string {
  if (!hash) return '—';
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

const EXPLORER_TX: Record<string, string> = {
  polygon:  'https://polygonscan.com/tx',
  arbitrum: 'https://arbiscan.io/tx',
  base:     'https://basescan.org/tx',
  gnosis:   'https://gnosisscan.io/tx',
};

export function explorerTxUrl(chain: string, hash: string): string {
  const base = EXPLORER_TX[chain] ?? 'https://polygonscan.com/tx';
  return `${base}/${hash}`;
}
