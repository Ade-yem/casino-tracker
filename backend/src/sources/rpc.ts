import { createPublicClient, http, parseAbi, type AbiEvent } from 'viem';
import { polygon, base, arbitrum } from 'viem/chains';

const CHAIN_MAP = { polygon, base, arbitrum } as const;
type SupportedChain = keyof typeof CHAIN_MAP;

export interface RawLogEvent {
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  address: `0x${string}`;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
  logIndex: number;
}

/**
 * viem public client for reading on-chain event logs.
 * Used when neither a subgraph nor an explorer API is available.
 */
export class RpcClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;

  constructor(chainSlug: SupportedChain, rpcUrl: string) {
    this.client = createPublicClient({
      chain: CHAIN_MAP[chainSlug],
      transport: http(rpcUrl),
    });
  }

  async getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber() as Promise<bigint>;
  }

  async getBlockTimestamp(blockNumber: bigint): Promise<number> {
    const block = await this.client.getBlock({ blockNumber });
    return Number((block as { timestamp: bigint }).timestamp);
  }

  /**
   * Fetch raw event logs for a contract + ABI event signature.
   * Splits large ranges into chunks to stay within RPC limits.
   *
   * @param eventSignature - Full event signature string, e.g.
   *   'event Transfer(address indexed from, address indexed to, uint256 value)'
   */
  async getLogs(opts: {
    address: `0x${string}`;
    eventSignature: string;
    fromBlock: bigint;
    toBlock: bigint;
    chunkSize?: bigint;
  }): Promise<RawLogEvent[]> {
    const chunkSize = opts.chunkSize ?? 2000n;
    const parsed = parseAbi([opts.eventSignature]);
    const abiEvent = parsed[0] as AbiEvent;
    const allLogs: RawLogEvent[] = [];

    let from = opts.fromBlock;
    while (from <= opts.toBlock) {
      const to = from + chunkSize - 1n > opts.toBlock ? opts.toBlock : from + chunkSize - 1n;
      const logs: unknown[] = await this.client.getLogs({
        address: opts.address,
        event: abiEvent,
        fromBlock: from,
        toBlock: to,
      });
      for (const log of logs as Array<{
        blockNumber: bigint | null;
        transactionHash: `0x${string}` | null;
        address: `0x${string}`;
        topics: readonly `0x${string}`[];
        data: `0x${string}`;
        logIndex: number | null;
      }>) {
        allLogs.push({
          blockNumber: log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? '0x',
          address: log.address,
          topics: log.topics,
          data: log.data,
          logIndex: log.logIndex ?? 0,
        });
      }
      from = to + 1n;
    }

    return allLogs;
  }

  /**
   * Approximate block number for a given UNIX timestamp via binary search.
   */
  async blockAtTimestamp(targetTs: number): Promise<bigint> {
    const latest: bigint = await this.client.getBlockNumber();
    let lo = 1n;
    let hi = latest;

    while (lo < hi) {
      const mid = (lo + hi) / 2n;
      const block = await this.client.getBlock({ blockNumber: mid });
      if (Number((block as { timestamp: bigint }).timestamp) < targetTs) {
        lo = mid + 1n;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
}
