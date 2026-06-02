import { DuneClient } from '@duneanalytics/client-sdk';
import { CASINOS, getCasinoChain } from '../registry/casinos.js';
import { CHAINS } from '../registry/chains.js';
import { ExplorerClient } from '../sources/explorer.js';
import type { CasinoAdapter } from './CasinoAdapter.js';
import { BetSwirlSubgraphAdapter } from './betswirl/BetSwirlSubgraphAdapter.js';
import { AzuroSubgraphAdapter } from './azuro/AzuroSubgraphAdapter.js';
import { PolymarketSubgraphAdapter } from './polymarket/PolymarketSubgraphAdapter.js';
import { GenericExplorerAdapter } from './generic/GenericExplorerAdapter.js';
import { GenericDuneAdapter } from './generic/GenericDuneAdapter.js';

const GRAPH_API_KEY     = process.env.GRAPH_API_KEY     ?? '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? '';
const DUNE_API_KEY      = process.env.DUNE_API_KEY      ?? '';

/**
 * Resolve a (casinoId, chainId) pair to a concrete CasinoAdapter.
 * Throws if the combination is not registered or misconfigured.
 */
export function resolveAdapter(casinoId: string, chainId: string): CasinoAdapter {
  const casino = CASINOS[casinoId];
  if (!casino) throw new Error(`Unknown casino: "${casinoId}". Available: ${Object.keys(CASINOS).join(', ')}`);

  const chainCfg = getCasinoChain(casinoId, chainId);

  switch (casino.adapter) {
    case 'BetSwirlSubgraph': {
      if (!chainCfg.subgraphDeploymentId) {
        throw new Error(`betswirl/${chainId}: subgraphDeploymentId not configured`);
      }
      return new BetSwirlSubgraphAdapter(chainId, GRAPH_API_KEY, chainCfg.subgraphDeploymentId);
    }

    case 'AzuroSubgraph': {
      // AzuroSubgraphAdapter reads the endpoint from the registry via the chainId slug
      return new AzuroSubgraphAdapter(chainId);
    }

    case 'PolymarketSubgraph': {
      return new PolymarketSubgraphAdapter(GRAPH_API_KEY);
    }

    case 'GenericExplorer': {
      if (!chainCfg.houseAddresses?.length) {
        throw new Error(`${casinoId}/${chainId}: houseAddresses not configured`);
      }
      if (!chainCfg.trackedTokens?.length) {
        throw new Error(`${casinoId}/${chainId}: trackedTokens not configured`);
      }
      const chainMeta = CHAINS[chainId];
      if (!chainMeta) throw new Error(`Unknown chain: "${chainId}"`);

      const explorerClient = new ExplorerClient({
        apiKey:   ETHERSCAN_API_KEY,
        baseUrl:  chainMeta.explorerApiUrl,
        chainId:  chainMeta.explorerChainId,
      });

      return new GenericExplorerAdapter({
        casinoId,
        chainId,
        houseAddresses: chainCfg.houseAddresses,
        trackedTokens:  chainCfg.trackedTokens,
        explorerClient,
      });
    }

    case 'GenericDune': {
      const queryId = chainCfg.duneQueryIds?.['daily'];
      if (!queryId) {
        throw new Error(`${casinoId}/${chainId}: duneQueryIds.daily not configured`);
      }
      if (!DUNE_API_KEY) {
        throw new Error(`${casinoId}/${chainId}: DUNE_API_KEY not configured`);
      }
      const duneClient = new DuneClient(DUNE_API_KEY);
      return new GenericDuneAdapter({
        casinoId,
        chainId,
        duneClient,
        queryId,
        columnMap: chainCfg.duneColumnMap,
      });
    }

    default:
      throw new Error(
        `No adapter registered for casino="${casinoId}" chain="${chainId}" adapter="${casino.adapter}"`
      );
  }
}

/** Default adapter: BetSwirl on Polygon (backward-compatible). */
export function defaultAdapter(): CasinoAdapter {
  return resolveAdapter('betswirl', 'polygon');
}

export type { CasinoAdapter };
