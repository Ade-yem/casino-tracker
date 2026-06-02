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
- [x] Frontend CasinoSelector with source badges + deprecation notes

---

## Phase B — Azuro Protocol (subgraph, Tier A) — DONE
- [x] Research schema (confirmed from Azuro-subgraphs GitHub)
  - Bet entity: `id`, `bettor`, `amount` (BigDecimal), `payout` (BigDecimal), `status`, `result`, `createdBlockTimestamp`, `createdTxHash`, `core.liquidityPool.token`
  - Status: Accepted | Canceled | Resolved; Result: Won | Lost
  - All-time summary from `liquidityPoolContracts` (betsAmount, wonBetsAmount)
  - Endpoint: self-hosted thegraph.azuro.org — **no API key required**
- [x] `adapters/azuro/AzuroSubgraphAdapter.ts`
- [x] Registry entries: azuro/polygon, azuro/arbitrum, azuro/gnosis
- [x] Gnosis chain added to chains registry

---

## Phase C — Polymarket (subgraph, Tier A) — DONE
- [x] Research: subgraph ID `Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp` (Polygon)
  - NOTE: deprecated 2026-04-28 — historical data only
  - Entities: `orderFilledEvents` (trades/inflows), `redemptions` (payouts/outflows)
  - Inflow = makerAmountFilled (USDC, 6 decimals); Outflow = payout (USDC)
- [x] `adapters/polymarket/PolymarketSubgraphAdapter.ts`
- [x] Registry entry: polymarket/polygon with deprecation note in catalog
- [x] Catalog endpoint surfaces `note` field for deprecated/limited sources

---

## Phase D — GenericExplorerAdapter (no-subgraph path) — DONE
- [x] `adapters/generic/GenericExplorerAdapter.ts`
  - Tracks ERC-20 transfers to/from house wallet addresses
  - Inflow = transfers to house, Outflow = transfers from house
  - Paginated via Etherscan v2 (one API key, all chains via chainid param)
- [x] Registry entries: overtime/arbitrum, overtime/base, winr/arbitrum
- [x] `ETHERSCAN_API_KEY` documented in .env.example
- [ ] **Pending**: ETHERSCAN_API_KEY from user to test live

---

## Phase E — Overtime / Thales (explorer, Tier B) — DONE (registry entry)
- [x] Added to registry: arbitrum + base
  - SportsAMM v2 Arbitrum: `0x47426195E4EdEf3E1bCB04e7c2c2e5736e04E79`
  - SportsAMM Base: `0xEd923be03CC3748A65bD24a27e1DF32F3b02B1fa`
  - Token: USDC on each chain
- [ ] Smoke test (requires ETHERSCAN_API_KEY)

---

## Phase F — WINR / JustBet (explorer, Tier B) — DONE (registry entry)
- [x] Added to registry: winr/arbitrum
  - WLP vault: `0x575f848D5d78F2b45AA63B1A88b23c2F68861C94`
  - Tokens: USDC + USDC.e on Arbitrum
- [ ] Smoke test (requires ETHERSCAN_API_KEY)

---

## Phase G — GenericDuneAdapter — TODO
- [ ] `adapters/generic/GenericDuneAdapter.ts`
  - Execute saved Dune queries by ID
  - Map rows: date, inflow_usd, outflow_usd, bet_count → DailyBreakdown/SummaryMetrics
  - Column name mappings configurable per-casino in registry
- [ ] Author at least one Dune query in the Dune UI (Overtime or WINR volume)
- [ ] Register duneQueryIds in casinos.ts for one casino

---

## Phase H — Frontend capability-aware UI — TODO
- [ ] Surface `sources` badges in dashboard header (already in CasinoSelector)
- [ ] Show/hide payout ratio card based on source capability (explorer = no payout ratio)
- [ ] Show/hide game type column in bet table for explorer-based casinos
- [ ] Show "Historical data only" warning for Polymarket
- [ ] Empty state: "No data in this range" with helpful context

---

## Credentials still needed

| Credential | Purpose | Status |
|------------|---------|--------|
| `ETHERSCAN_API_KEY` | Overtime, WINR (Phases E–F) | ❌ Need |

Already have:
- `GRAPH_API_KEY` ✅
- `DUNE_API_KEY` ✅
- `RPC_POLYGON`, `RPC_BASE`, `RPC_ARBITRUM` (Alchemy) ✅

---

## Contract address verification needed

The following addresses were included from public documentation and should be
verified on-chain before treating as authoritative:

| Casino | Chain | Address | Role | Status |
|--------|-------|---------|------|--------|
| Overtime | Arbitrum | `0x47426195E4EdEf3E1bCB04e7c2c2e5736e04E79` | SportsAMM v2 | Needs verification |
| Overtime | Base | `0xEd923be03CC3748A65bD24a27e1DF32F3b02B1fa` | SportsAMM | Needs verification |
| WINR | Arbitrum | `0x575f848D5d78F2b45AA63B1A88b23c2F68861C94` | WLP vault | Needs verification |
| Polymarket | Polygon | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e` | CTF Exchange | Confirmed (public) |

---

## Summary of all registered casino+chain combinations

| Casino | Chain | Source | Status |
|--------|-------|--------|--------|
| BetSwirl | Polygon | Subgraph | ✅ Live |
| BetSwirl | Base | Subgraph | ✅ Live |
| BetSwirl | Arbitrum | Subgraph | ✅ Live |
| Azuro | Polygon | Subgraph | ✅ Live |
| Azuro | Arbitrum | Subgraph | ✅ Live |
| Azuro | Gnosis | Subgraph | ✅ Live |
| Polymarket | Polygon | Subgraph | ⚠️ Historical (deprecated Apr 2026) |
| Overtime | Arbitrum | Explorer | ⏳ Needs ETHERSCAN_API_KEY |
| Overtime | Base | Explorer | ⏳ Needs ETHERSCAN_API_KEY |
| WINR/JustBet | Arbitrum | Explorer | ⏳ Needs ETHERSCAN_API_KEY |
