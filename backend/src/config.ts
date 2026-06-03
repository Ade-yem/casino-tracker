import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  graphApiKey: process.env.GRAPH_API_KEY ?? '',
  duneApiKey: process.env.DUNE_API_KEY ?? '',
  port: Number(process.env.PORT ?? 3001),
  graphBaseUrl: process.env.GRAPH_BASE_URL ?? 'https://gateway.thegraph.com/api/subgraphs/id/6rt22DL9aaAjJHDUZ25sSsPuvuKxp1Tnf8LBXhL8WdZi',
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '../cache.db'),
};

/** The Graph gateway endpoint for the BetSwirl Polygon subgraph. */
export function graphEndpoint(chain?: "base" | "polygon"): string {
  return chain === "base" ? config.graphBaseUrl : `https://gateway.thegraph.com/api/${config.graphApiKey}/deployments/id/${config.graphPolygonDeploymentId}`;
}

export function assertGraphConfigured(): void {
  if (!config.graphApiKey) {
    throw new Error(
      'GRAPH_API_KEY is not set. Create a free key at https://thegraph.com/studio and add it to backend/.env'
    );
  }
}
