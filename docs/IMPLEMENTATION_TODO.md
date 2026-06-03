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
  - SportsAMMV2 Arbitrum: `0xfb64e79a562f7250131cf528242ceb10fdc82395` (Arbiscan verified)
  - SportsAMMV2 Base: `0xa1ead27ebbd90b8ef385f264cc66ba4c96767fdf` (Codeslaw verified)
  - Token: USDC on each chain
- [x] ETHERSCAN_API_KEY added to .env
- [ ] Smoke test (requires production environment — network blocked locally)

---

## Phase F — WINR / JustBet (explorer, Tier B) — DONE (registry entry)
- [x] Added to registry: winr/arbitrum
  - WLP vault: `0x9ee7109adc2f6514dea1f63bcca1340a320cca9a` (Arbiscan verified)
  - Tokens: USDC + USDC.e on Arbitrum
- [x] ETHERSCAN_API_KEY added to .env
- [ ] Smoke test (requires production environment — network blocked locally)

---

## Phase G — GenericDuneAdapter — DONE
- [x] `adapters/generic/GenericDuneAdapter.ts`
  - Executes saved Dune queries by ID via `@duneanalytics/client-sdk`
  - Accepts `start_date`/`end_date` query parameters (text)
  - Maps rows: date, inflow_usd, outflow_usd → DailyBreakdown/SummaryMetrics
  - Column name mappings configurable per-casino via `duneColumnMap` in registry
  - Capabilities: DAILY_AGGREGATES, ALL_TIME_SUMMARY, DATE_RANGE (no BET_HISTORY)
- [x] Wired into adapter registry (`GenericDune` adapter type)
- [x] `duneColumnMap` field added to `CasinoChainConfig`
- [ ] Author at least one Dune query in the Dune UI (Overtime or WINR volume)
  - NOTE: requires manual Dune query authoring + `duneQueryIds.daily` in casinos.ts

---

## Phase H — Frontend capability-aware UI — DONE
- [x] Surface `sources` badges in dashboard header (in CasinoSelector)
- [x] Hide payout ratio card for explorer-only sources (`hidePayoutRatio` prop on SummaryCards)
- [x] Hide game type column + filter for explorer-only sources (`hideGameType` prop on TransactionTable)
- [x] Show "Historical data only" warning for Polymarket (via `note` field in CasinoSelector)
- [x] Empty state: "No data in this range" with helpful context (uses `currentEntry.note` if set)
- [x] Dynamic subtitle based on source type (explorer vs subgraph vs dune)
- [x] Hide bet table entirely for dune-only sources (no BET_HISTORY capability)
- [x] Chain-aware block explorer links in TransactionTable (Polygonscan/Arbiscan/Basescan/Gnosisscan)

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
| Overtime | Arbitrum | `0xfb64e79a562f7250131cf528242ceb10fdc82395` | SportsAMMV2 Proxy | ✅ Arbiscan verified |
| Overtime | Base | `0xa1ead27ebbd90b8ef385f264cc66ba4c96767fdf` | SportsAMMV2 | ✅ Codeslaw verified |
| WINR | Arbitrum | `0x9ee7109adc2f6514dea1f63bcca1340a320cca9a` | WLP vault | ✅ Arbiscan verified |
| Polymarket | Polygon | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982e` | CTF Exchange | ✅ Confirmed (public) |

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
| Overtime | Arbitrum | Explorer | ✅ Key configured, smoke test pending |
| Overtime | Base | Explorer | ✅ Key configured, smoke test pending |
| WINR/JustBet | Arbitrum | Explorer | ✅ Key configured, smoke test pending |
