import axios from 'axios';

export interface ExplorerTx {
  hash: string;
  from: string;
  to: string;
  value: string;             // wei
  timeStamp: string;         // UNIX seconds as string
  tokenSymbol?: string;
  tokenDecimal?: string;
  contractAddress?: string;
  isError?: string;
  functionName?: string;
}

/**
 * Etherscan v2 client. One API key works for all EVM chains —
 * just pass the correct chainid param.
 */
export class ExplorerClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly chainId: number;

  constructor(opts: { apiKey: string; baseUrl: string; chainId: number }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl;
    this.chainId = opts.chainId;
  }

  /** Fetch ERC-20 token transfers to/from a contract. */
  async getTokenTransfers(opts: {
    address: string;
    startBlock?: number;
    endBlock?: number;
    page?: number;
    offset?: number;
  }): Promise<ExplorerTx[]> {
    const params = {
      module: 'account',
      action: 'tokentx',
      address: opts.address,
      startblock: opts.startBlock ?? 0,
      endblock: opts.endBlock ?? 99999999,
      page: opts.page ?? 1,
      offset: opts.offset ?? 1000,
      sort: 'asc',
      apikey: this.apiKey,
      chainid: this.chainId,
    };
    const res = await axios.get(this.baseUrl, { params, timeout: 30_000 });
    if (res.data.status === '0' && res.data.message !== 'No transactions found') {
      throw new Error(`Explorer API error: ${res.data.message} — ${res.data.result}`);
    }
    return Array.isArray(res.data.result) ? res.data.result : [];
  }

  /** Fetch normal ETH/native token transactions for a contract. */
  async getNativeTxs(opts: {
    address: string;
    startBlock?: number;
    endBlock?: number;
    page?: number;
    offset?: number;
  }): Promise<ExplorerTx[]> {
    const params = {
      module: 'account',
      action: 'txlist',
      address: opts.address,
      startblock: opts.startBlock ?? 0,
      endblock: opts.endBlock ?? 99999999,
      page: opts.page ?? 1,
      offset: opts.offset ?? 1000,
      sort: 'asc',
      apikey: this.apiKey,
      chainid: this.chainId,
    };
    const res = await axios.get(this.baseUrl, { params, timeout: 30_000 });
    if (res.data.status === '0' && res.data.message !== 'No transactions found') {
      throw new Error(`Explorer API error: ${res.data.message} — ${res.data.result}`);
    }
    return Array.isArray(res.data.result) ? res.data.result : [];
  }
}
