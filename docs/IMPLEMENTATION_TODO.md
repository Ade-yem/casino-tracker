# Casino Platform Implementation — TODO & Plan

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done

---

## Phase A — BetSwirl multi-chain (DONE)
- [x] BetSwirl Polygon (subgraph)
- [x] BetSwirl Base (subgraph)
- [x] BetSwirl Arbitrum (subgraph)
- [x] CasinoAdapter interface
- [x] Layered architecture (domain/registry/adapters/sources)
- [x] /api/catalog endpoint
- [x] Frontend CasinoSelector

---

## Phase B — Azuro Protocol (subgraph, Tier A)

### Research needed
- [ ] Confirm subgraph deployment IDs for Polygon, Arbitrum, Gnosis
- [ ] Confirm Azuro Bet entity schema fields (amount, payout, bettor, timestamp, condition)
- [ ] Confirm contract addresses per chain

### Implementation
- [ ] `registry/casinos.ts` — add azuro entry with per-chain deployment IDs
- [ ] `adapters/azuro/AzuroSubgraphAdapter.ts` — implement CasinoAdapter
  - fetchBets(fromTs, toTs) using Azuro Bet entity
  - fetchDayData(fromTs, toTs) using any DayData entity if available, else aggregate from bets
  - getAllTimeSummary() from protocol-level aggregates
  - getDateRange()
- [ ] Smoke test: verify /api/summary?casino=azuro&chain=polygon returns real data

### Azuro schema notes (from research)
- Entities: `Bet`, `Condition`, `Game`, `LiquidityPool`, `CoreBet`
- Bet fields: `id`, `bettor`, `amount`, `payout`, `status` (Pending/Won/Lost/Canceled/Cashed Out), `createdAt`, `resolvedAt`, `txHash`, `core { address }`, `outcomes { currentOdds }`
- Status enum values differ from BetSwirl — map `Won/Lost/Canceled` → resolved/refunded
- Amount in token decimals, token via `affiliate` or `core.token`

---

## Phase C — Polymarket (subgraph, Tier A)

### Research needed
- [ ] Confirm Polymarket subgraph deployment ID on Polygon
- [ ] Confirm CTF Exchange contract address (0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e)
- [ ] Confirm schema entities for tracking volume/trades

### Implementation
- [ ] `registry/casinos.ts` — add polymarket entry
- [ ] `adapters/polymarket/PolymarketSubgraphAdapter.ts`
  - Polymarket is prediction market, not casino — "inflow" = USDC spent on outcome tokens, "outflow" = USDC redeemed on winning positions
  - Entities likely: `OrderFilledEvent`, `MarketData`, `ConditionResolution`
  - Game type = market question text (truncated)
- [ ] Smoke test

---

## Phase D — GenericExplorerAdapter (no-subgraph path)

### Goal
Reusable adapter for any casino defined only by house wallet address(es) + tracked tokens. Tracks inflow (ERC-20 transfers TO house wallet) and outflow (transfers FROM house wallet) as proxy for wagers and payouts.

### Source
- Etherscan v2 API (`https://api.etherscan.io/v2/api?chainid=<id>`)
- One API key for all chains
- **Requires `ETHERSCAN_API_KEY` in .env — need user to provide**

### Implementation
- [ ] Update `backend/.env` with ETHERSCAN_API_KEY (need user to provide)
- [ ] `adapters/generic/GenericExplorerAdapter.ts`
  - paginate tokentx for each house address + tracked token
  - classify transfers: to-house = inflow, from-house = outflow
  - group by date for daily breakdown
  - return capability: `{ gameLevelBets: false, payoutRatio: false, ... }`
- [ ] `registry/casinos.ts` — add casino entries with houseAddresses + trackedTokens

### Capability notes
Explorer-based casinos cannot report:
- Individual bet amounts or game types (only transfer amounts)
- Payout ratio (can infer rough ratio from outflow/inflow but misleading)
- Win/loss per bet

---

## Phase E — PancakeSwap Prediction (explorer + RPC, Tier B)

### Contract info
- PancakeSwap Prediction v2 (BNB Chain): `0x18b2a687610328590bc8f2e5fedde3b582a49cda`
- Token: BNB (native) and CAKE
- Chain: BNB Chain (chainId 56) — **new chain, add to registry**

### Research needed
- [ ] Confirm contract address on BNB
- [ ] Identify house wallet / treasury address (protocol fee recipient)
- [ ] Any Arbitrum deployment?

### Implementation
- [ ] Add BNB Chain to `registry/chains.ts`
- [ ] Add PancakeSwap Prediction to `registry/casinos.ts`
- [ ] Reuse `GenericExplorerAdapter` with the contract address

### Note
PancakeSwap Prediction is technically a prediction market (bull/bear on BNB price rounds), not a traditional casino. "Inflow" = total BNB bet in rounds, "outflow" = winnings paid out. The contract itself collects the house fee (~3%) per round.

---

## Phase F — Overtime / Thales (explorer + Dune, Tier B)

### Contract info
- Overtime v2 on Arbitrum: needs confirmation
- Overtime v2 on Base: needs confirmation
- Token: USDC, sUSD

### Research needed
- [ ] Confirm house wallet / AMM vault address on each chain
- [ ] Find Dune dashboard query IDs for Overtime volume
- [ ] Check if any unofficial subgraph exists

### Implementation
- [ ] Add Overtime to `registry/casinos.ts` with explorer + dune sources
- [ ] Reuse `GenericExplorerAdapter`
- [ ] Optionally: `GenericDuneAdapter` if good Dune query found

---

## Phase G — WINR / JustBet (explorer + RPC, Tier B)

### Contract info
- WINR Protocol on Arbitrum: WLP vault (house LP)
- JustBet.gg: game contracts on Arbitrum
- Token: USDC, ETH, WINR

### Research needed
- [ ] Confirm WLP vault or house wallet address
- [ ] Token list (USDC/USDC.e/ETH)

### Implementation
- [ ] Add WINR/JustBet to `registry/casinos.ts`
- [ ] Reuse `GenericExplorerAdapter`

---

## Phase H — GenericDuneAdapter

### Goal
Execute pre-authored Dune queries by ID, map rows to DailyBreakdown/SummaryMetrics.

### Implementation
- [ ] `adapters/generic/GenericDuneAdapter.ts`
  - Constructor takes DuneClient + queryIds (daily, summary, transactions)
  - `getDailyBreakdown`: calls getLatestResult(duneQueryIds.daily), maps rows
  - `getSummary`: calls getLatestResult(duneQueryIds.summary), maps rows
  - Row shape is configurable via column name mappings in registry
- [ ] Author Dune queries for at least one casino (Overtime or Polymarket)

### Dune query design
Each query should accept parameters: `house_address`, `chain`, `start_date`, `end_date`
Output columns (standard): `date`, `inflow_usd`, `outflow_usd`, `bet_count`

---

## Phase I — Frontend capability-aware UI

- [ ] Show/hide payout ratio card based on `capability.payoutRatio`
- [ ] Show/hide game type column in table when `gameLevelBets=false`
- [ ] Show data source badge (Subgraph / Explorer / Dune) in header
- [ ] "No data" empty state improvements

---

## Credentials still needed from user

| Credential | Purpose | Status |
|------------|---------|--------|
| `ETHERSCAN_API_KEY` | All explorer-based casinos (Phases D–G) | ❌ Need |

Already have:
- `GRAPH_API_KEY` ✅
- `DUNE_API_KEY` ✅
- `RPC_POLYGON`, `RPC_BASE`, `RPC_ARBITRUM` (Alchemy) ✅

---

## Implementation Order (recommended)

1. **Azuro** — Second subgraph adapter, validates abstraction with different schema
2. **Polymarket** — Third subgraph adapter, prediction market model
3. **GenericExplorerAdapter** — After Etherscan key is provided
4. **PancakeSwap Prediction** — First explorer-only casino
5. **Overtime** — Explorer + optional Dune
6. **WINR/JustBet** — Explorer
7. **GenericDuneAdapter** — For Dune-covered casinos
8. **Frontend capability UI** — Final polish
