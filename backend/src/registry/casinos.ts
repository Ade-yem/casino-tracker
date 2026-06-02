import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export type DataSource = 'subgraph' | 'explorer' | 'dune' | 'rpc';

export interface CasinoChainConfig {
  sources: DataSource[];
  subgraphDeploymentId?: string;
  contractAddress?: string;
  duneQueryIds?: Record<string, number>;
}

export interface CasinoConfig {
  id: string;
  name: string;
  url: string;
  chains: Record<string, CasinoChainConfig>;
}

export const CASINOS: Record<string, CasinoConfig> = {
  betswirl: {
    id: 'betswirl',
    name: 'BetSwirl',
    url: 'https://www.betswirl.com',
    chains: {
      polygon: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_POLYGON_DEPLOYMENT_ID ??
          'QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2',
        contractAddress: '0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA',
      },
      base: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_BASE_DEPLOYMENT_ID ??
          'QmZuY97Ai2EHqc3GmA26n3WzwrGJZ7orXvEi3SmqmSe11T',
        contractAddress: '0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA',
      },
      arbitrum: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_ARBITRUM_DEPLOYMENT_ID ??
          'QmYMwfki8kR9LwJ2Jv9BFdr938Js8THGS1J3PSd38W7jQF',
        contractAddress: '0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA',
      },
    },
  },
};

export function getCasino(id: string): CasinoConfig {
  const casino = CASINOS[id];
  if (!casino) throw new Error(`Unknown casino: "${id}". Available: ${Object.keys(CASINOS).join(', ')}`);
  return casino;
}

export function getCasinoChain(casinoId: string, chainId: string): CasinoChainConfig {
  const casino = getCasino(casinoId);
  const chain = casino.chains[chainId];
  if (!chain) {
    throw new Error(
      `Casino "${casinoId}" is not available on chain "${chainId}". Available chains: ${Object.keys(casino.chains).join(', ')}`
    );
  }
  return chain;
}

export function listCatalog(): Array<{ casinoId: string; chainId: string; sources: DataSource[] }> {
  return Object.values(CASINOS).flatMap((c) =>
    Object.entries(c.chains).map(([chainId, cc]) => ({
      casinoId: c.id,
      chainId,
      sources: cc.sources,
    }))
  );
}
