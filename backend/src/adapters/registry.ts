import { getCasino, getCasinoChain } from '../registry/casinos.js';
import type { CasinoAdapter } from './CasinoAdapter.js';
import { BetSwirlSubgraphAdapter } from './betswirl/BetSwirlSubgraphAdapter.js';

const GRAPH_API_KEY = process.env.GRAPH_API_KEY ?? '';

/**
 * Resolve a (casinoId, chainId) pair to a concrete CasinoAdapter.
 * Throws if the combination is not registered.
 */
export function resolveAdapter(casinoId: string, chainId: string): CasinoAdapter {
  // Validate that the combo exists in the registry first.
  const chain = getCasinoChain(casinoId, chainId);

  if (casinoId === 'betswirl' && chain.sources.includes('subgraph')) {
    if (!chain.subgraphDeploymentId) {
      throw new Error(`betswirl/${chainId}: subgraphDeploymentId not configured`);
    }
    return new BetSwirlSubgraphAdapter(chainId, GRAPH_API_KEY, chain.subgraphDeploymentId);
  }

  throw new Error(
    `No adapter registered for casino="${casinoId}" chain="${chainId}" with sources: ${chain.sources.join(', ')}`
  );
}

/** Default adapter: BetSwirl on Polygon (backward-compatible). */
export function defaultAdapter(): CasinoAdapter {
  return resolveAdapter('betswirl', 'polygon');
}

export type { CasinoAdapter };
