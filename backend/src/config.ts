import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Polygon deployment ID confirmed from BetSwirl SDK source
const POLYGON_DEPLOYMENT_ID =
  process.env.GRAPH_POLYGON_DEPLOYMENT_ID ??
  'QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2';

export const config = {
  graphApiKey: process.env.GRAPH_API_KEY ?? '',
  graphPolygonDeploymentId: POLYGON_DEPLOYMENT_ID,
  // BetSwirl Bank contract on Polygon (confirmed from BetSwirl SDK)
  casinoStoreAddress:
    process.env.CASINO_STORE_ADDRESS ?? '0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA',
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
