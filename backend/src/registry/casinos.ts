import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export type DataSource = 'subgraph' | 'explorer' | 'dune' | 'rpc';

export interface TrackedToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface CasinoChainConfig {
  sources: DataSource[];
  /** The Graph subgraph deployment ID (when sources includes 'subgraph'). */
  subgraphDeploymentId?: string;
  /** For Azuro: self-hosted endpoint (no API key required). */
  subgraphEndpoint?: string;
  /** House wallet addresses to track (for 'explorer' / 'rpc' sources). */
  houseAddresses?: string[];
  /** ERC-20 tokens to track for explorer-based casinos. */
  trackedTokens?: TrackedToken[];
  /** Dune query IDs keyed by metric name (e.g. 'daily' → query ID). */
  duneQueryIds?: Record<string, number>;
  /** Override Dune column names for non-standard query schemas. */
  duneColumnMap?: { date?: string; inflow_usd?: string; outflow_usd?: string; bet_count?: string };
}

export interface CasinoConfig {
  id: string;
  name: string;
  url: string;
  /** Adapter class name to use for this casino. */
  adapter: 'BetSwirlSubgraph' | 'AzuroSubgraph' | 'PolymarketSubgraph' | 'GenericExplorer' | 'GenericDune';
  chains: Record<string, CasinoChainConfig>;
}

export const CASINOS: Record<string, CasinoConfig> = {
  // ---------------------------------------------------------------------------
  // BetSwirl — on-chain casino with official subgraphs per chain
  // Bank contract is the same address on all chains
  // ---------------------------------------------------------------------------
  betswirl: {
    id: 'betswirl',
    name: 'BetSwirl',
    url: 'https://www.betswirl.com',
    adapter: 'BetSwirlSubgraph',
    chains: {
      polygon: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_POLYGON_DEPLOYMENT_ID ??
          'QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2',
        houseAddresses: ['0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA'],
      },
      base: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_BASE_DEPLOYMENT_ID ??
          'QmZuY97Ai2EHqc3GmA26n3WzwrGJZ7orXvEi3SmqmSe11T',
        houseAddresses: ['0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA'],
      },
      arbitrum: {
        sources: ['subgraph'],
        subgraphDeploymentId:
          process.env.GRAPH_ARBITRUM_DEPLOYMENT_ID ??
          'QmYMwfki8kR9LwJ2Jv9BFdr938Js8THGS1J3PSd38W7jQF',
        houseAddresses: ['0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA'],
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Azuro Protocol — decentralized sportsbook / prediction market
  // Self-hosted subgraph on thegraph.azuro.org (no API key required)
  // ---------------------------------------------------------------------------
  azuro: {
    id: 'azuro',
    name: 'Azuro',
    url: 'https://azuro.org',
    adapter: 'AzuroSubgraph',
    chains: {
      polygon: {
        sources: ['subgraph'],
        subgraphEndpoint: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3',
      },
      arbitrum: {
        sources: ['subgraph'],
        subgraphEndpoint: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-arbitrum-one-v3',
      },
      gnosis: {
        sources: ['subgraph'],
        subgraphEndpoint: 'https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v3',
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Polymarket — prediction market on Polygon
  // Note: subgraph deprecated 2026-04-28 (new CTF Exchange contracts).
  //       Data is historical up to that date.
  // Subgraph ID: Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp
  // ---------------------------------------------------------------------------
  polymarket: {
    id: 'polymarket',
    name: 'Polymarket',
    url: 'https://polymarket.com',
    adapter: 'PolymarketSubgraph',
    chains: {
      polygon: {
        sources: ['subgraph'],
        subgraphDeploymentId: 'Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp',
        houseAddresses: ['0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e'],
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Overtime / Thales — decentralized sportsbook
  // No official subgraph — explorer-based (inflow/outflow only)
  // House addresses are the sports AMM contracts (collects/distributes USDC)
  // NOTE: requires ETHERSCAN_API_KEY
  // ---------------------------------------------------------------------------
  overtime: {
    id: 'overtime',
    name: 'Overtime Markets',
    url: 'https://overtimemarkets.xyz',
    adapter: 'GenericExplorer',
    chains: {
      arbitrum: {
        sources: ['explorer'],
        houseAddresses: [
          '0xfb64e79a562f7250131cf528242ceb10fdc82395', // SportsAMMV2 Proxy (Arbiscan verified)
        ],
        trackedTokens: [
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
        ],
      },
      base: {
        sources: ['explorer'],
        houseAddresses: [
          '0xa1ead27ebbd90b8ef385f264cc66ba4c96767fdf', // SportsAMMV2 (Base, Codeslaw verified)
        ],
        trackedTokens: [
          { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
        ],
      },
    },
  },

  // ---------------------------------------------------------------------------
  // WINR / JustBet — on-chain casino on Arbitrum
  // No official subgraph — explorer-based
  // WLP vault is the house LP that receives bet inflows and pays out winnings
  // NOTE: requires ETHERSCAN_API_KEY
  // ---------------------------------------------------------------------------
  winr: {
    id: 'winr',
    name: 'WINR / JustBet',
    url: 'https://justbet.io',
    adapter: 'GenericExplorer',
    chains: {
      arbitrum: {
        sources: ['explorer'],
        houseAddresses: [
          '0x9ee7109adc2f6514dea1f63bcca1340a320cca9a', // WLP vault (house LP, Arbiscan verified)
        ],
        trackedTokens: [
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC',   decimals: 6 },
          { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.e', decimals: 6 },
        ],
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      `Casino "${casinoId}" is not available on chain "${chainId}". ` +
      `Available chains: ${Object.keys(casino.chains).join(', ')}`
    );
  }
  return chain;
}

export function listCatalog(): Array<{
  casinoId: string; chainId: string; sources: DataSource[];
}> {
  return Object.values(CASINOS).flatMap((c) =>
    Object.entries(c.chains).map(([chainId, cc]) => ({
      casinoId: c.id,
      chainId,
      sources: cc.sources,
    }))
  );
}
