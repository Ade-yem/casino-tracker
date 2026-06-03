# Multi-Casino, Multi-Chain, Multi-Source Architecture — Design

> Status: **Design proposal** (no code yet). This document defines how to extend
> the tracker from a single subgraph (BetSwirl/Polygon) into a pluggable engine
> that tracks many decentralized casinos across many EVM chains, drawing from
> The Graph, block-explorer APIs, Dune Analytics, and raw RPC.

---

## 1. Goals & Principles

1. **Track many casinos** across many EVM chains (start: Polygon, Base, Arbitrum).
2. **Multiple data sources per casino** — a casino may expose a subgraph on one
   chain, only an explorer on another, and a Dune dashboard everywhere.
3. **Adding a casino = adding a config entry + (optionally) one adapter file.**
   No edits to routes, aggregation, or the frontend.
4. **Switch context easily** — `?casino=betswirl&chain=base` selects everything.
5. **Normalize at the edge** — every source produces the same domain types
   (`Bet`, `DailyBreakdown`, `SummaryMetrics`), so the API and UI never change.
6. **Graceful degradation** — casinos without a subgraph still work via explorer
   + Dune; the system picks the richest source available and can fall back.

### Design tension to resolve up front
Subgraph casinos give *game-level* bets (stake, payout, win/lose). Explorer/RPC
casinos only give *ERC-20 transfers* to/from house wallets — so "payout ratio"
and "win/lose" are not directly observable; we infer **inflow/outflow/net** from
transfer direction. The domain model must therefore mark which metrics are
*measured* vs *not available* per source (see §4, `Capability`).

---

## 2. Current State (what we're extending)

```
backend/src/
  config.ts              # single GRAPH_API_KEY + one deployment id + one bank addr
  api/graph.ts           # BetSwirl-specific Graph client + queries
  services/aggregator.ts # getSummary / getDailyBreakdown / getAllTimeSummary
  services/sync.ts       # normalizeBet + SQLite cache
  routes/*.ts            # summary, daily-breakdown, transactions, export, meta, refresh
  db/*                   # optional SQLite cache
```

Everything is hardwired to one casino + one chain + one source. The refactor
introduces three new layers **below** the routes without changing their shape.

---

## 3. Target Architecture (layers)

```
┌──────────────────────────────────────────────────────────────┐
│ Routes  (unchanged shape; now read ?casino & ?chain)          │
│   /api/summary  /api/daily-breakdown  /api/transactions ...    │
└───────────────────────────┬──────────────────────────────────┘
                            │ resolve(casino, chain, source?)
┌───────────────────────────▼──────────────────────────────────┐
│ Provider Factory / Resolver                                    │
│  reads the Casino Registry, picks the best available adapter   │
└───────────────────────────┬──────────────────────────────────┘
                            │ returns a CasinoAdapter
┌───────────────────────────▼──────────────────────────────────┐
│ Casino Adapters (the extension point)                          │
│  BetSwirlSubgraphAdapter · AzuroSubgraphAdapter ·              │
│  GenericExplorerAdapter · GenericDuneAdapter · ...             │
│  Each maps a casino's raw data -> normalized domain types      │
└───────────────────────────┬──────────────────────────────────┘
                            │ uses casino-agnostic transport clients
┌───────────────────────────▼──────────────────────────────────┐
│ Source Clients (transport only, no casino knowledge)           │
│  GraphqlClient · ExplorerClient(Etherscan v2) ·                │
│  DuneClient · RpcClient(viem/Alchemy)                          │
└────────────────────────────────────────────────────────────── ┘
```

**Key idea:** *Source clients* know how to talk to a protocol (GraphQL, REST,
JSON-RPC). *Casino adapters* know how to interpret one casino's data into our
domain model. *The registry* declares which adapter+source to use for each
casino/chain. Routes and UI only ever see normalized types.

---

## 4. Domain Model & Core Interfaces

```typescript
// domain/types.ts — normalized, source-agnostic

export type ChainId = 137 | 8453 | 42161; // Polygon | Base | Arbitrum (extensible)

export type DataSourceKind = 'subgraph' | 'explorer' | 'dune' | 'rpc';

export interface CasinoContext {
  casinoId: string;     // 'betswirl'
  chainId: ChainId;     // 8453
  source: DataSourceKind;
}

export interface Bet {
  id: string;
  bettor: string;
  amountUsd: number;     // house inflow
  payoutUsd: number;     // house outflow (0 if not observable / lost)
  token: string;
  gameType: string | null; // null when source can't tell (explorer/rpc)
  resolved: boolean;
  refunded: boolean;
  betTxHash: string | null;
  rollTxHash: string | null;
  timestamp: number;     // UNIX seconds
}

export interface DailyBreakdown {
  date: string;          // 'YYYY-MM-DD'
  inflow: number;
  outflow: number;
  net: number;
}

export interface SummaryMetrics {
  totalInflows: number;
  totalOutflows: number;
  netPosition: number;
  payoutRatio: number;   // 0 when outflows not measurable
  txCount: number;
}

/** What a given adapter/source can actually answer, so the UI can adapt. */
export interface Capability {
  gameLevelBets: boolean;   // true for subgraphs, false for explorer/rpc
  payoutRatio: boolean;     // requires payout data
  perGameBreakdown: boolean;
  dailyBreakdown: boolean;
}
```

### The extension point: `CasinoAdapter`

```typescript
// adapters/CasinoAdapter.ts

export interface DateRange { fromTs: number; toTs: number; }

export interface CasinoAdapter {
  readonly context: CasinoContext;
  readonly capability: Capability;

  getSummary(range: DateRange): Promise<SummaryMetrics>;
  getDailyBreakdown(range: DateRange): Promise<DailyBreakdown[]>;
  getTransactions(range: DateRange, page: { limit: number; offset: number }):
    Promise<{ data: Bet[]; total: number }>;

  /** Optional: min/max dates with data, used to default the UI range. */
  getDataRange?(): Promise<{ minDate: string; maxDate: string } | null>;
}
```

**To add a casino you implement this interface once** (or reuse a generic
adapter) and register it. Nothing else changes.

---

## 5. Source Clients (casino-agnostic transport)

### 5.1 GraphqlClient
Thin wrapper over `axios.post` to a Graph endpoint, built from
`gateway.thegraph.com/api/{key}/deployments/id/{deploymentId}`. Already exists
as `gql()` in `api/graph.ts`; promote it to `sources/graphql.ts` parameterized
by endpoint.

### 5.2 ExplorerClient — **Etherscan API v2 (multichain)**
Etherscan v2 unifies Polygonscan/Basescan/Arbiscan behind **one base URL + one
API key**, selecting the chain with a `chainid` query param:

```
GET https://api.etherscan.io/v2/api
    ?chainid=8453
    &module=account&action=tokentx
    &address={houseWallet}
    &contractaddress={tokenAddress}
    &startblock=0&endblock=99999999&sort=asc
    &apikey={ETHERSCAN_API_KEY}
```

One `ETHERSCAN_API_KEY` covers all three chains. Used to pull ERC-20 `Transfer`
events to/from house wallets for casinos **without** a subgraph.
> ⚠️ Verify the exact v2 base path against current Etherscan docs at build time;
> the v1 per-domain hosts (api.polygonscan.com, api.basescan.org, api.arbiscan.io)
> remain available as a fallback if needed.

### 5.3 DuneClient
Use the official **`@duneanalytics/client-sdk`**. Auth header `X-Dune-API-Key`.
Lifecycle: execute a saved query → poll status → fetch results, or use the
"latest results" shortcut. We store **per-casino Dune `query_id`s** in the
registry and pass `query_parameters` (house address, chain, date range).

```typescript
import { DuneClient, QueryParameter } from '@duneanalytics/client-sdk';
const dune = new DuneClient(process.env.DUNE_API_KEY!);
const res = await dune.runQuery({
  queryId,
  query_parameters: [
    QueryParameter.text('house', houseAddr),
    QueryParameter.text('chain', 'base'),
    QueryParameter.date('start', startIso),
    QueryParameter.date('end', endIso),
  ],
});
```
Free tier: ~2,500 credits/month, ~55 req/min — fine for cached dashboards.
Creating/editing queries via API needs the Analyst plan; we'll **author queries
in the Dune UI** and only *execute* them by id from the backend.

### 5.4 RpcClient — viem + Alchemy
For chains where we want trustless verification or there's no explorer coverage,
use `viem` `publicClient.getLogs` filtered to the ERC-20 `Transfer` topic with
the house wallet as indexed `from`/`to`. One Alchemy URL per chain (provided by
you). Also used to spot-verify explorer/subgraph numbers.

---

## 6. The Casino Registry (declarative config)

A single source of truth describing every casino, its chains, and the data
sources available on each. This is what you edit to add a casino.

```typescript
// registry/casinos.ts

export interface ChainConfig {
  sources: DataSourceKind[];          // preference order, best first
  subgraphDeploymentId?: string;      // for 'subgraph'
  houseAddresses?: string[];          // for 'explorer' / 'rpc'
  trackedTokens?: { address: string; symbol: string; decimals: number }[];
  duneQueryIds?: { summary?: number; daily?: number; transactions?: number };
}

export interface CasinoConfig {
  id: string;
  displayName: string;
  adapter: string;                    // which adapter class to instantiate
  chains: Partial<Record<ChainId, ChainConfig>>;
}

export const CASINOS: Record<string, CasinoConfig> = {
  betswirl: {
    id: 'betswirl',
    displayName: 'BetSwirl',
    adapter: 'BetSwirlSubgraph',
    chains: {
      137:   { sources: ['subgraph', 'explorer'], subgraphDeploymentId: 'QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2' },
      8453:  { sources: ['subgraph', 'explorer'], subgraphDeploymentId: 'QmZuY97Ai2EHqc3GmA26n3WzwrGJZ7orXvEi3SmqmSe11T' },
      42161: { sources: ['subgraph', 'explorer'], subgraphDeploymentId: 'QmYMwfki8kR9LwJ2Jv9BFdr938Js8THGS1J3PSd38W7jQF' },
    },
  },

  // Example: a casino with NO subgraph — explorer + dune only
  // (house wallets are illustrative; fill in real addresses when added)
  // examplecasino: {
  //   id: 'examplecasino', displayName: 'Example', adapter: 'GenericExplorer',
  //   chains: {
  //     42161: {
  //       sources: ['dune', 'explorer'],
  //       houseAddresses: ['0x...'],
  //       trackedTokens: [{ address: '0xaf88...', symbol: 'USDC', decimals: 6 }],
  //       duneQueryIds: { daily: 1234567, summary: 1234568 },
  //     },
  //   },
  // },
};
```

> All BetSwirl deployment IDs above were extracted from the BetSwirl SDK source
> (`@betswirl/sdk-core`). The BetSwirl Bank contract is the same address on every
> chain: `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA`.

### Resolver / Factory

```typescript
// registry/resolve.ts
export function resolveAdapter(
  casinoId: string,
  chainId: ChainId,
  preferred?: DataSourceKind
): CasinoAdapter {
  const casino = CASINOS[casinoId] ?? fail('unknown casino');
  const chain = casino.chains[chainId] ?? fail('casino not on this chain');
  const source = preferred && chain.sources.includes(preferred)
    ? preferred
    : chain.sources[0];                       // best available
  return AdapterFactory.create(casino.adapter, { casinoId, chainId, source }, chain);
}
```

---

## 7. Context Switching (API surface)

All data routes gain two query params (defaulting to `betswirl` / `137`):

```
GET /api/summary?casino=betswirl&chain=8453&startDate=&endDate=
GET /api/daily-breakdown?casino=betswirl&chain=42161&...
GET /api/transactions?casino=...&chain=...&source=explorer   # optional override
```

New discovery endpoint so the frontend can build casino/chain switchers:

```
GET /api/catalog
→ [
    { id:'betswirl', displayName:'BetSwirl',
      chains:[
        { chainId:137,  name:'Polygon',  sources:['subgraph','explorer'] },
        { chainId:8453, name:'Base',     sources:['subgraph','explorer'] },
        { chainId:42161,name:'Arbitrum', sources:['subgraph','explorer'] }
      ] }
  ]
```

Each response also echoes the resolved `context` + `capability`, so the UI can
hide "payout ratio" / per-game charts when a source can't provide them.

**Frontend:** add a `CasinoSelector` + `ChainSelector` in the header; store
`{casino, chain}` in context and thread into every `api/client.ts` call.

---

## 8. Per-Source Strategy

| Source | Granularity | Gives payout/win? | Best for |
|--------|-------------|-------------------|----------|
| **Subgraph** | Per bet (game-level) | ✅ yes | BetSwirl, Azuro, Polymarket |
| **Dune** | Pre-aggregated SQL | ✅ if query models it | casinos with community dashboards; heavy aggregation |
| **Explorer v2** | ERC-20 transfers | ❌ inflow/outflow only | no-subgraph casinos; quick onboarding |
| **RPC (viem)** | Raw logs | ❌ inflow/outflow only | trustless verification; gap-filling |

**Fallback chain** (declared per casino in `sources` order): try the preferred
source; on hard failure, the resolver may fall through to the next. Explorer and
RPC produce the same `Bet` shape but with `gameType=null`, `payoutUsd` from
outbound transfers, and `capability.payoutRatio=false`.

### Generic explorer/RPC casino logic (no subgraph)
- **Inflow** = ERC-20 transfers **to** a house wallet (player deposits/wagers).
- **Outflow** = ERC-20 transfers **from** a house wallet (payouts).
- **Net** = inflow − outflow; **payout ratio** = not reported (flagged in capability).
- Multiple house wallets and multiple tracked tokens are summed; decimals per token.

---

## 9. Eligible Platforms (research shortlist)

Ranked by data availability and how cleanly they fit this engine. (Custodial
sites like Stake/Rollbit are excluded — they aren't on-chain settled.)

| # | Platform | Chains | On-chain? | Subgraph | Best source | Tier |
|---|----------|--------|-----------|----------|-------------|------|
| 1 | **BetSwirl** | Polygon, Base, Arbitrum, AVAX, BNB | ✅ games | ✅ per chain | Subgraph | **A** |
| 2 | **Azuro Protocol** | Polygon, Arbitrum, Base, Optimism | ✅ sportsbook/LP | ✅ official, per chain | Subgraph | **A** |
| 3 | **Polymarket** | Polygon (+Arbitrum) | ✅ prediction (CTF) | ✅ official | Subgraph | **A** |
| 4 | **Overtime / Thales** | Optimism, Arbitrum, Base | ✅ sportsbook | ❓ verify | Explorer + Dune | **B** |
| 5 | **PancakeSwap Prediction** | BNB, Arbitrum | ✅ price rounds | ❌ | Explorer (contract events) | **B** |
| 6 | **WINR / JustBet** | Arbitrum | ✅ games (WLP) | ❌ | Explorer + RPC | **B** |
| 7 | **SX Bet** | SX Network (Arbitrum Orbit L3) | ✅ exchange | ❓ | Custom RPC | **C** |
| 8 | **Decentral Games** | Polygon | ✅ metaverse casino | ❌ | Explorer (treasury) | **C** |

**Recommended rollout:** prove the architecture with **BetSwirl across all 3
chains** (subgraph), then add **Azuro** and **Polymarket** (subgraph) to exercise
a *second and third schema*, then add one **explorer-only** casino (e.g.
PancakeSwap Prediction or a chosen house-wallet target) to exercise the
no-subgraph path, and wire **Dune** for one platform that has a good dashboard.

Concrete anchors gathered so far:
- **BetSwirl Bank** (all chains): `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA`
- **Polymarket CTF Exchange** (Polygon): `0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e`
- **PancakeSwap Prediction v2** (BNB): `0x18b2a687610328590bc8f2e5fedde3b582a49cda`
- **Azuro**: official subgraphs per chain (Polygon/Arbitrum/Base v3).

> Addresses/IDs for non-BetSwirl platforms still need on-chain confirmation
> before they go in the registry (same verify-before-trust rule we used for the
> BetSwirl schema).

---

## 10. Proposed Directory Structure

```
backend/src/
  domain/
    types.ts                 # Bet, DailyBreakdown, SummaryMetrics, Capability, ...
  sources/                   # transport only (casino-agnostic)
    graphql.ts
    explorer.ts              # Etherscan v2 client
    dune.ts                  # @duneanalytics/client-sdk wrapper
    rpc.ts                   # viem clients per chain
  adapters/                  # the extension point (casino-specific)
    CasinoAdapter.ts         # interface + AdapterFactory
    betswirl/
      BetSwirlSubgraphAdapter.ts
      queries.ts             # the GraphQL we already verified
    generic/
      GenericExplorerAdapter.ts   # reusable for any house-wallet casino
      GenericDuneAdapter.ts
  registry/
    chains.ts                # ChainId -> { name, explorerChainId, rpcEnvVar }
    casinos.ts               # CASINOS registry (edit to add a casino)
    resolve.ts               # resolveAdapter()
  services/
    aggregator.ts            # generic helpers reused by adapters
  routes/                    # +catalog.ts; existing routes read casino/chain
  db/                        # cache keyed by (casino, chain, source)
```

`api/graph.ts` is split: the transport half → `sources/graphql.ts`; the
BetSwirl queries → `adapters/betswirl/`.

---

## 11. Caching & Keys

SQLite cache rows become keyed by `(casinoId, chainId, source, betId)` and the
`sync_state` table by `(casinoId, chainId, source)`. `POST /api/refresh` takes
`casino`/`chain` to scope the clear. This keeps multiple casinos/chains from
clobbering each other.

---

## 12. Environment Variables (additions)

```bash
# The Graph (existing)
GRAPH_API_KEY=

# Etherscan API v2 — one key, all chains (Polygon/Base/Arbitrum/...)
ETHERSCAN_API_KEY=

# Dune Analytics
DUNE_API_KEY=

# Alchemy RPC (you will provide these)
ALCHEMY_POLYGON_URL=
ALCHEMY_BASE_URL=
ALCHEMY_ARBITRUM_URL=

# Defaults
DEFAULT_CASINO=betswirl
DEFAULT_CHAIN=137
```

---

## 13. Phased Implementation Plan

- **Phase A — Refactor to layers (no behavior change).** Extract `domain/types`,
  `sources/graphql`, `adapters/betswirl`, `registry`. Routes resolve a
  `CasinoAdapter` for `betswirl/137`. Verify identical output to today.
- **Phase B — Multi-chain BetSwirl.** Add Base + Arbitrum deployment IDs; wire
  `?chain=`. Add `/api/catalog`. Smoke-test all three chains.
- **Phase C — Explorer v2 client + GenericExplorerAdapter.** Implement
  house-wallet inflow/outflow tracking; add capability flags; add one
  explorer-only casino end-to-end.
- **Phase D — Dune client + GenericDuneAdapter.** Author dashboards in Dune UI,
  store query ids in registry, execute-by-id from backend.
- **Phase E — RPC (viem/Alchemy).** Verification path + gap-filling; spot-check
  command like the current `introspect`.
- **Phase F — Frontend selectors.** Casino + chain + (optional) source switchers;
  capability-aware UI (hide payout ratio when unavailable).
- **Phase G — Second/third subgraph casinos** (Azuro, Polymarket) to validate the
  abstraction against genuinely different schemas.

---

## 14. Open Decisions (need your input)

1. **Source priority per casino** — when both subgraph and explorer exist, prefer
   subgraph (richer) by default? (Proposed: yes.)
2. **Dune** — do you have a Dune API key + a plan tier? (Free tier can *execute*
   saved queries but not *create* them via API; we'd author queries in the UI.)
3. **Etherscan v2 key** — one key is enough for all three chains; can you provide it?
4. **Which non-BetSwirl casino to onboard first** for the explorer/Dune path —
   Azuro (subgraph, easy) or a no-subgraph target (exercises the harder path)?
5. **Cross-chain aggregation** — do you also want an "all chains combined" view
   per casino, or always one chain at a time? (Proposed: per-chain first, combined later.)

---

## 15. Why this is easy to extend

- **New chain:** add an entry to `registry/chains.ts` + the chain block in a
  casino's config. No code.
- **New casino with a subgraph:** add a config entry + a small adapter that maps
  its schema to `Bet`/`DailyBreakdown`. ~1 file.
- **New casino without a subgraph:** add a config entry with `houseAddresses` +
  `trackedTokens` and reuse `GenericExplorerAdapter`/`GenericDuneAdapter`. **Zero
  new code.**
- **Routes, aggregation, caching, and the entire frontend stay the same** because
  everything speaks the normalized domain model.
