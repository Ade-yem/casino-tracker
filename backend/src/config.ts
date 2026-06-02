import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  graphApiKey: process.env.GRAPH_API_KEY ?? '',
  duneApiKey: process.env.DUNE_API_KEY ?? '',
  port: Number(process.env.PORT ?? 3001),
  dbPath: process.env.DB_PATH ?? path.resolve(__dirname, '../cache.db'),
};

export function assertGraphConfigured(): void {
  if (!config.graphApiKey) {
    throw new Error(
      'GRAPH_API_KEY is not set. Create a free key at https://thegraph.com/studio and add it to backend/.env'
    );
  }
}
