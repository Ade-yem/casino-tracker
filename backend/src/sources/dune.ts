import { DuneClient as DuneSDK, QueryParameter } from '@duneanalytics/client-sdk';

export interface DuneRow {
  [key: string]: unknown;
}

/**
 * Thin wrapper around @duneanalytics/client-sdk.
 *
 * Rate limits (free tier): 10 executions/month, 1 concurrent.
 * Prefer getLatestResult() to avoid burning execution quota.
 */
export class DuneClient {
  private readonly client: DuneSDK;

  constructor(apiKey: string) {
    this.client = new DuneSDK(apiKey);
  }

  /**
   * Execute a saved query and wait for fresh results.
   * Use sparingly — counts against the monthly execution quota.
   */
  async runQuery(
    queryId: number,
    params: Record<string, string> = {}
  ): Promise<DuneRow[]> {
    const query_parameters = Object.entries(params).map(([name, value]) =>
      QueryParameter.text(name, value)
    );
    const result = await this.client.runQuery({ queryId, query_parameters });
    return (result.result?.rows ?? []) as DuneRow[];
  }

  /**
   * Return the latest cached result for a query without triggering execution.
   * Much faster and does not consume execution quota.
   */
  async getLatestResult(queryId: number): Promise<DuneRow[]> {
    const result = await this.client.getLatestResult({ queryId });
    return (result.result?.rows ?? []) as DuneRow[];
  }
}
