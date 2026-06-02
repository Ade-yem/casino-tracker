import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface ChainConfig {
  id: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerApiUrl: string;
  explorerChainId: number;
}

export const CHAINS: Record<string, ChainConfig> = {
  polygon: {
    id: 'polygon',
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.RPC_POLYGON ?? 'https://polygon-rpc.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    explorerChainId: 137,
  },
  base: {
    id: 'base',
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.RPC_BASE ?? 'https://mainnet.base.org',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    explorerChainId: 8453,
  },
  arbitrum: {
    id: 'arbitrum',
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.RPC_ARBITRUM ?? 'https://arb1.arbitrum.io/rpc',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    explorerChainId: 42161,
  },
  gnosis: {
    id: 'gnosis',
    chainId: 100,
    name: 'Gnosis',
    rpcUrl: process.env.RPC_GNOSIS ?? 'https://rpc.gnosischain.com',
    explorerApiUrl: 'https://api.etherscan.io/v2/api',
    explorerChainId: 100,
  },
};

export function getChain(id: string): ChainConfig {
  const chain = CHAINS[id];
  if (!chain) throw new Error(`Unknown chain: "${id}". Available: ${Object.keys(CHAINS).join(', ')}`);
  return chain;
}
