import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend directory regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  graphApiKey: process.env.GRAPH_API_KEY ?? '',
  graphSubgraphId: process.env.GRAPH_SUBGRAPH_ID ?? 'FL3ePDCBbShPvfRJTaSCNnehiqxsPHzpLud6CpbHoeKW',
  casinoStoreAddress: process.env.CASINO_STORE_ADDRESS ?? '',
  port: Number(process.env.PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '../cache.db'),
};

/** The Graph decentralized-network query endpoint for the BetSwirl subgraph. */
export function graphEndpoint(): string {
  return `https://gateway-arbitrum.network.thegraph.com/api/${config.graphApiKey}/subgraphs/id/${config.graphSubgraphId}`;
}

/** Throw early with a clear message if a required secret is missing. */
export function assertGraphConfigured(): void {
  if (!config.graphApiKey) {
    throw new Error(
      'GRAPH_API_KEY is not set. Create a free key at https://thegraph.com/studio and add it to backend/.env'
    );
  }
}
