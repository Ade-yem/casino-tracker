# Casino House Wallet Flow Tracker — CLAUDE.md

## Project Overview

A full-stack blockchain analytics dashboard that tracks and visualizes the cash flows (deposits, withdrawals, net position) of an on-chain crypto casino operator's hot wallet(s) on Polygon. Primary target: **BetSwirl on Polygon**.

The stack is:
- **Backend:** Node.js + TypeScript, Express, SQLite (via `better-sqlite3`), `axios`
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Recharts
- **Primary data source:** The Graph subgraph (pre-indexed BetSwirl game data)
- **Secondary data source:** Polygonscan API (spot-check verification only)

### Why The Graph instead of Polygonscan

| | Polygonscan API | The Graph Subgraph |
|---|---|---|
| Data model | Raw ERC-20 transfers | Structured game-level bets |
| Rate limit | 5 req/sec (free tier) | ~1,000 req/min (free tier) |
| Filtering | Post-fetch in code | Server-side `where:` clauses |
| Daily aggregates | Manual SQL grouping | Pre-built `*DayData` entities |
| Payout data | Not available | `payout` field per bet |
| Requires API key | Yes (Polygonscan) | Yes (The Graph Studio) |

The Graph gives richer, pre-indexed data including individual game bets, player stats, and pre-aggregated daily totals — eliminating most of the sync and aggregation complexity.

---

## Subgraph Reference

**Subgraph ID:** `FL3ePDCBbShPvfRJTaSCNnehiqxsPHzpLud6CpbHoeKW`
**Explorer URL:** https://thegraph.com/explorer/subgraphs/FL3ePDCBbShPvfRJTaSCNnehiqxsPHzpLud6CpbHoeKW?view=Query&chain=arbitrum-one
**Query endpoint:**
```
POST https://gateway-arbitrum.network.thegraph.com/api/{GRAPH_API_KEY}/subgraphs/id/FL3ePDCBbShPvfRJTaSCNnehiqxsPHzpLud6CpbHoeKW
```

### Known Entity Types

**Game bet entities** (one per game type):
```
DiceBet | CoinTossBet | RouletteBet | KenoBet | RussianRouletteBet
```

**Aggregate / daily entities** (pre-computed by the subgraph):
```
GameTokenDayData | TokenBalancesDayData | StakingPoolDayData | UserTokenDayData
```

**Supporting entities:**
```
Store | UserToken | Token | GameToken | StakingPool | PvPToken | PvPGameToken
```

### Core Bet Entity Fields

```graphql
{
  diceBets {
    id                        # unique bet ID (use as cursor for pagination)
    bettor                    # player wallet address
    amount                    # raw token units — divide by 10^decimals
    payout                    # what the house returned (0 if player lost)
    status                    # "Pending" | "Win" | "Lose"
    timestamp                 # UNIX seconds (block.timestamp)
    betTxnHash                # tx hash when bet was placed
    rollTxnHash               # tx hash when result resolved
    gameToken { symbol decimals }
  }
}
```

`amount` = house inflow (player's stake), `payout` = house outflow (returned to player).
Payout ratio = `SUM(payout) / SUM(amount)` across all resolved bets.

### Pre-Aggregated DayData Entity

Eliminates the need for manual daily aggregation in `aggregator.ts`:

```graphql
{
  gameTokenDayDatas(
    orderBy: date
    orderDirection: asc
    where: { date_gte: 1717200000, date_lte: 1719705600 }
  ) {
    date                      # UNIX day timestamp (start of day UTC)
    totalBetAmount            # sum of all bet amounts that day
    totalPayoutAmount         # sum of all payouts that day
    totalBetCount
    gameToken { symbol decimals }
  }
}
```

### Unresolved: Store Entity ID

The `Store` entity holds cumulative totals. Its ID is the BetSwirl contract address on Polygon.
Find it by running this query in the Graph Explorer Playground:

```graphql
{ stores(first: 5) { id totalBetAmount totalPayoutAmount totalBetCount } }
```

Record the address as `CASINO_STORE_ADDRESS` in `.env`.

---

## Repository Structure

```
casino-tracker/
├── CLAUDE.md
├── .gitignore
├── .env.example
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Express server entry point
│       ├── db/
│       │   ├── schema.ts          # SQLite schema (optional cache)
│       │   └── client.ts          # better-sqlite3 singleton
│       ├── api/
│       │   └── graph.ts           # The Graph query client (primary)
│       ├── services/
│       │   ├── sync.ts            # Optional: cache bets to SQLite
│       │   └── aggregator.ts      # Thin layer — sums across game types
│       └── routes/
│           ├── transactions.ts    # GET /api/transactions
│           ├── summary.ts         # GET /api/summary
│           ├── dailyBreakdown.ts  # GET /api/daily-breakdown
│           ├── refresh.ts         # POST /api/refresh
│           └── exportCsv.ts       # GET /api/export/csv
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts          # fetch wrappers for backend endpoints
│       ├── components/
│       │   ├── Dashboard.tsx
│       │   ├── SummaryCards.tsx
│       │   ├── TransactionChart.tsx
│       │   ├── TransactionTable.tsx
│       │   ├── DateRangeSelector.tsx
│       │   └── ExportButton.tsx
│       └── types/
│           └── index.ts           # Shared TypeScript interfaces
```

---

## Environment Setup

### Prerequisites
- Node.js 18+ (`node --version`)
- npm 9+
- A free Graph API key: https://thegraph.com/studio → API Keys
- (Optional) A free Polygonscan API key for spot-checking: https://polygonscan.com/apis

### 1. Clone & Branch

```bash
git clone https://github.com/ade-yem/casino-tracker.git
cd casino-tracker
git checkout -b claude/claude-md-setup-plan-O57EJ
```

### 2. Environment Variables

`.env.example` (copy to `backend/.env`):

```bash
# Primary data source — The Graph
GRAPH_API_KEY=your_graph_api_key_here
GRAPH_SUBGRAPH_ID=FL3ePDCBbShPvfRJTaSCNnehiqxsPHzpLud6CpbHoeKW

# BetSwirl Store contract address on Polygon
# Find by querying: { stores(first: 5) { id } } in the Graph Explorer playground
CASINO_STORE_ADDRESS=

# Secondary — Polygonscan (spot-check only, not required for MVP)
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
POLYGON_RPC_URL=https://polygon-rpc.com

PORT=3001
```

### 3. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run in Development

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

---

## Implementation Plan

Work through phases in order. Each has clear acceptance criteria.

---

### Phase 1 — Research & Contract Identification (1–2 hours)

**Goal:** Confirm the BetSwirl Store contract address on Polygon and verify subgraph data.

Steps:
1. Get a free Graph API key from https://thegraph.com/studio
2. Open the Graph Explorer playground for the subgraph (URL above)
3. Run `{ stores(first: 5) { id totalBetAmount totalPayoutAmount } }` to find the Store ID
4. Run a sample bets query to confirm field names:
   ```graphql
   { diceBets(first: 3 orderBy: timestamp orderDirection: desc) {
     id bettor amount payout status timestamp
     gameToken { symbol decimals }
   }}
   ```
5. Record `CASINO_STORE_ADDRESS` and `GRAPH_API_KEY` in `backend/.env`

**Acceptance criteria:** You can run a GraphQL query against the subgraph and get real BetSwirl data back.

---

### Phase 2 — Backend Scaffold (1–2 hours)

**Goal:** Working Express server with SQLite schema and placeholder routes.

#### 2.1 Init backend

```bash
mkdir backend && cd backend
npm init -y
npm install express better-sqlite3 axios dotenv cors
npm install -D typescript ts-node-dev @types/node @types/express @types/better-sqlite3 @types/cors
npx tsc --init
```

Key `tsconfig.json` settings:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

`package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

#### 2.2 SQLite Schema (`src/db/schema.ts`)

SQLite is an optional write-through cache. The Graph is the source of truth.

```typescript
export const CREATE_BETS_TABLE = `
  CREATE TABLE IF NOT EXISTS bets (
    id           TEXT PRIMARY KEY,
    bettor       TEXT NOT NULL,
    amount       TEXT NOT NULL,        -- raw token units
    amount_usd   REAL NOT NULL,        -- amount / 10^decimals
    payout_usd   REAL NOT NULL,        -- payout / 10^decimals
    token        TEXT NOT NULL,        -- 'USDC' | 'USDT' | 'BETS'
    game_type    TEXT NOT NULL,        -- 'Dice' | 'CoinToss' | 'Roulette' | 'Keno' | 'RussianRoulette'
    status       TEXT NOT NULL,        -- 'Pending' | 'Win' | 'Lose'
    roll_tx_hash TEXT,
    timestamp    INTEGER NOT NULL      -- UNIX seconds
  )
`;

export const CREATE_SYNC_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_state (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_timestamp  INTEGER NOT NULL DEFAULT 0,
    last_sync_time  INTEGER NOT NULL DEFAULT 0
  )
`;
```

#### 2.3 Express server (`src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/transactions', (req, res) => res.json({ data: [] }));
app.get('/api/summary', (req, res) => res.json({}));
app.get('/api/daily-breakdown', (req, res) => res.json([]));
app.post('/api/refresh', (req, res) => res.json({ status: 'ok' }));
app.get('/api/export/csv', (req, res) => res.sendStatus(200));

initDb();
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
```

**Acceptance criteria:** `npm run dev` starts; `curl http://localhost:3001/api/summary` returns `{}`.

---

### Phase 3 — The Graph Client & Data Fetching (3–4 hours)

**Goal:** Query BetSwirl game data from The Graph subgraph.

#### 3.1 Graph client (`src/api/graph.ts`)

```typescript
import axios from 'axios';

const ENDPOINT = `https://gateway-arbitrum.network.thegraph.com/api/${process.env.GRAPH_API_KEY}/subgraphs/id/${process.env.GRAPH_SUBGRAPH_ID}`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await axios.post(ENDPOINT, { query, variables }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
  });
  if (res.data.errors) throw new Error(res.data.errors[0].message);
  return res.data.data as T;
}

export interface RawBet {
  id: string;
  bettor: string;
  amount: string;
  payout: string;
  status: 'Pending' | 'Win' | 'Lose';
  timestamp: string;
  rollTxnHash: string | null;
  gameToken: { symbol: string; decimals: string };
}

export interface DayData {
  date: string;
  totalBetAmount: string;
  totalPayoutAmount: string;
  totalBetCount: string;
  gameToken: { symbol: string; decimals: string };
}

const GAME_TYPES = ['diceBets', 'coinTossBets', 'rouletteBets', 'kenoBets', 'russianRouletteBets'] as const;
type GameType = typeof GAME_TYPES[number];

// Cursor-based pagination — never use skip for large datasets
async function fetchBetsForGame(gameType: GameType, fromTs: number, toTs: number): Promise<RawBet[]> {
  const query = `
    query($lastId: ID!, $from: Int!, $to: Int!) {
      ${gameType}(
        first: 1000
        orderBy: id
        orderDirection: asc
        where: { id_gt: $lastId, timestamp_gte: $from, timestamp_lte: $to }
      ) {
        id bettor amount payout status timestamp rollTxnHash
        gameToken { symbol decimals }
      }
    }
  `;

  const all: RawBet[] = [];
  let lastId = '';

  while (true) {
    const data = await gql<Record<string, RawBet[]>>(query, { lastId, from: fromTs, to: toTs });
    const page = data[gameType] ?? [];
    all.push(...page);
    if (page.length < 1000) break;
    lastId = page[page.length - 1].id;
  }

  return all;
}

// Fetch bets across all game types in parallel
export async function fetchAllBets(fromTs: number, toTs: number): Promise<RawBet[]> {
  const pages = await Promise.all(GAME_TYPES.map(g => fetchBetsForGame(g, fromTs, toTs)));
  return pages.flat().sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
}

// Use pre-aggregated DayData — one query replaces manual daily grouping
export async function fetchDayData(fromTs: number, toTs: number): Promise<DayData[]> {
  const query = `
    query($from: Int!, $to: Int!) {
      gameTokenDayDatas(
        first: 1000
        orderBy: date
        orderDirection: asc
        where: { date_gte: $from, date_lte: $to }
      ) {
        date totalBetAmount totalPayoutAmount totalBetCount
        gameToken { symbol decimals }
      }
    }
  `;
  const data = await gql<{ gameTokenDayDatas: DayData[] }>(query, { from: fromTs, to: toTs });
  return data.gameTokenDayDatas;
}

// Summary from Store entity — single call for cumulative totals
export async function fetchStoreSummary(storeId: string) {
  const query = `
    query($id: ID!) {
      store(id: $id) { id totalBetAmount totalPayoutAmount totalBetCount }
    }
  `;
  const data = await gql<{ store: { totalBetAmount: string; totalPayoutAmount: string; totalBetCount: string } }>(
    query, { id: storeId.toLowerCase() }
  );
  return data.store;
}
```

#### 3.2 Normalize raw bets (`src/services/sync.ts`)

```typescript
import { RawBet } from '../api/graph';

export interface NormalizedBet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  status: 'Pending' | 'Win' | 'Lose';
  roll_tx_hash: string | null;
  timestamp: number;
}

export function normalizeBet(raw: RawBet, gameType: string): NormalizedBet {
  const decimals = Number(raw.gameToken.decimals);
  return {
    id: raw.id,
    bettor: raw.bettor,
    amount_usd: Number(raw.amount) / 10 ** decimals,
    payout_usd: Number(raw.payout) / 10 ** decimals,
    token: raw.gameToken.symbol,
    game_type: gameType,
    status: raw.status,
    roll_tx_hash: raw.rollTxnHash,
    timestamp: Number(raw.timestamp),
  };
}
```

**Acceptance criteria:** Calling `fetchAllBets(fromTs, toTs)` returns real BetSwirl bets. Spot-check 3 `rollTxnHash` values on Polygonscan.

---

### Phase 4 — Aggregation Service & API Routes (2–3 hours)

**Goal:** Compute metrics and serve them via the API.

#### 4.1 Aggregator (`src/services/aggregator.ts`)

The Graph's DayData entities do the heavy lifting. The aggregator is a thin normalization layer:

```typescript
import { fetchDayData, fetchAllBets, fetchStoreSummary } from '../api/graph';

export interface SummaryMetrics {
  totalInflows: number;       // SUM(amount_usd) across all resolved bets
  totalOutflows: number;      // SUM(payout_usd)
  netPosition: number;        // inflows - outflows
  payoutRatio: number;        // outflows / inflows (0–1)
  txCount: number;
}

export interface DailyBreakdown {
  date: string;               // 'YYYY-MM-DD'
  inflow: number;
  outflow: number;
  net: number;
}

export async function getSummary(fromTs?: number, toTs?: number): Promise<SummaryMetrics> {
  // Option A — use Store entity for all-time summary (fastest)
  const store = await fetchStoreSummary(process.env.CASINO_STORE_ADDRESS!);
  const decimals = 6; // USDC/USDT on Polygon
  const inflows  = Number(store.totalBetAmount)    / 10 ** decimals;
  const outflows = Number(store.totalPayoutAmount) / 10 ** decimals;
  return {
    totalInflows:  inflows,
    totalOutflows: outflows,
    netPosition:   inflows - outflows,
    payoutRatio:   inflows === 0 ? 0 : outflows / inflows,
    txCount:       Number(store.totalBetCount),
  };
  // Option B — for date-filtered summary, fall back to fetching bets and summing
}

export async function getDailyBreakdown(fromTs: number, toTs: number): Promise<DailyBreakdown[]> {
  const dayDatas = await fetchDayData(fromTs, toTs);
  // Group by date, sum across game tokens
  const byDate = new Map<string, DailyBreakdown>();
  for (const d of dayDatas) {
    const date = new Date(Number(d.date) * 1000).toISOString().slice(0, 10);
    const dec  = Number(d.gameToken.decimals);
    const inflow  = Number(d.totalBetAmount)    / 10 ** dec;
    const outflow = Number(d.totalPayoutAmount) / 10 ** dec;
    const existing = byDate.get(date) ?? { date, inflow: 0, outflow: 0, net: 0 };
    byDate.set(date, {
      date,
      inflow:  existing.inflow  + inflow,
      outflow: existing.outflow + outflow,
      net:     existing.net     + (inflow - outflow),
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
```

#### 4.2 Routes

Wire up real implementations:

- `GET /api/transactions?startDate=&endDate=&limit=&offset=` — calls `fetchAllBets`, returns paginated JSON
- `GET /api/summary?startDate=&endDate=` — calls `getSummary`
- `GET /api/daily-breakdown?startDate=&endDate=` — calls `getDailyBreakdown`
- `POST /api/refresh` — clears SQLite cache if used; returns `{ status: 'ok' }`
- `GET /api/export/csv` — streams transactions as CSV

Date params: accept ISO strings (`2024-01-01`), convert to UNIX seconds via `new Date(s).getTime() / 1000`.

**Acceptance criteria:** `curl http://localhost:3001/api/summary` returns real numbers. `curl http://localhost:3001/api/daily-breakdown?startDate=2024-01-01&endDate=2024-01-31` returns 31 entries.

---

### Phase 5 — Frontend Scaffold (1–2 hours)

**Goal:** Working Vite + React + Tailwind project with a single Dashboard page.

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite recharts date-fns papaparse
npm install -D @types/papaparse
```

`vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
```

`src/types/index.ts`:

```typescript
export interface Bet {
  id: string;
  bettor: string;
  amount_usd: number;
  payout_usd: number;
  token: string;
  game_type: string;
  status: 'Pending' | 'Win' | 'Lose';
  roll_tx_hash: string | null;
  timestamp: number;
}

export interface SummaryMetrics {
  totalInflows: number;
  totalOutflows: number;
  netPosition: number;
  payoutRatio: number;
  txCount: number;
}

export interface DailyBreakdown {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}
```

**Acceptance criteria:** `npm run dev` loads at `localhost:5173` with no console errors.

---

### Phase 6 — Frontend Components (4–5 hours)

Build components in this order.

#### 6.1 `src/api/client.ts`

```typescript
const BASE = '/api';

export async function fetchSummary(startDate?: string, endDate?: string): Promise<SummaryMetrics> { ... }
export async function fetchDailyBreakdown(startDate?: string, endDate?: string): Promise<DailyBreakdown[]> { ... }
export async function fetchTransactions(params: { startDate?: string; endDate?: string; limit?: number; offset?: number }): Promise<{ data: Bet[]; total: number }> { ... }
export async function triggerRefresh(): Promise<void> { ... }
```

#### 6.2 `SummaryCards.tsx`

Four cards (responsive grid):
- **Total Inflows** — green, formatted as USD
- **Total Outflows** — red
- **Net Position** — green if positive, red if negative
- **Payout Ratio** — `XX.X%`

Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` for amounts.

#### 6.3 `TransactionChart.tsx`

Two tabs:
1. **Daily Flow** — `BarChart` (Recharts), inflow/outflow bars per day
2. **Cumulative Net** — `LineChart` of running net position

Colors: inflows `#22c55e`, outflows `#ef4444`, net `#3b82f6`.

Recharts components: `ResponsiveContainer`, `BarChart`/`LineChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `Bar`/`Line`.

#### 6.4 `TransactionTable.tsx`

Columns: Date, Tx Hash (links to `https://polygonscan.com/tx/{hash}`), Game, Status, Token, Bet Amount, Payout.

Features:
- Filter by status (All / Win / Lose)
- Filter by game type
- Sort by amount (default: descending)
- Pagination (25 rows per page)
- Hash display: first 6 + `...` + last 4 chars

#### 6.5 `DateRangeSelector.tsx`

Two `<input type="date">` fields with presets: Last 7 days, Last 30 days, Last 90 days.
On change: call parent `onRangeChange(startDate, endDate)`.

#### 6.6 `ExportButton.tsx`

```tsx
<button onClick={() => window.open(`/api/export/csv?startDate=${start}&endDate=${end}`, '_blank')}>
  Export CSV
</button>
```

#### 6.7 `Dashboard.tsx`

```tsx
export default function Dashboard() {
  const [range, setRange] = useState({ start: thirtyDaysAgo(), end: today() });
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [daily, setDaily] = useState<DailyBreakdown[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    Promise.all([
      fetchSummary(range.start, range.end).then(setSummary),
      fetchDailyBreakdown(range.start, range.end).then(setDaily),
      fetchTransactions({ startDate: range.start, endDate: range.end }).then(r => setBets(r.data)),
    ]);
  }, [range]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold">BetSwirl Wallet Tracker</h1>
      <DateRangeSelector onRangeChange={setRange} />
      {summary && <SummaryCards metrics={summary} />}
      <TransactionChart daily={daily} />
      <TransactionTable bets={bets} />
      <ExportButton start={range.start} end={range.end} />
    </main>
  );
}
```

**Acceptance criteria:** Dashboard renders all four summary metrics, a chart with daily bars, and a paginated bet table — all populated from the live backend.

---

### Phase 7 — Testing & Validation (2–3 hours)

Manual spot-check checklist:
- [ ] Pick 5 `rollTxnHash` values from the table; verify amounts on Polygonscan
- [ ] Confirm `payoutRatio` = `totalOutflows / totalInflows` by computing independently
- [ ] Test date range filter: narrow to 1 day, verify bet count matches Graph Explorer
- [ ] Check that `status: Lose` bets have `payout_usd === 0`
- [ ] Resize to mobile width — cards and charts must remain readable
- [ ] Test with no data in range — show "No data" empty state

Edge cases:
- `totalInflows === 0` → `payoutRatio = 0` (division by zero guard)
- API key missing → return 500 with descriptive message
- Graph API timeout → catch and return 503 with retry hint
- Bets with `status: Pending` → exclude from payout ratio calculation

---

### Phase 8 — Documentation & Polish (2–3 hours)

#### 8.1 README.md

Sections:
1. **What this is** — 2-sentence description
2. **Live demo** — link if deployed
3. **Setup** — condensed version of Phase 2 above
4. **Architecture** — ASCII diagram
5. **Key findings** — brief research memo
6. **Tech stack** — bullet list

#### 8.2 Research Findings Memo (`FINDINGS.md`)

After running the tracker on 30–90 days of data, answer:
- What was the observed payout ratio over the period?
- Does it align with BetSwirl's published house edge per game?
- What is the net position trend — is the house consistently profitable?
- Which game generates the most volume? Which has the highest house edge?
- Any anomalies (single large payout, sudden volume spike)?

#### 8.3 `.gitignore`

```
node_modules/
dist/
.env
*.db
*.db-shm
*.db-wal
```

---

## API Reference

| Method | Endpoint | Query Params | Description |
|--------|----------|--------------|-------------|
| GET | `/api/transactions` | `startDate`, `endDate`, `limit`, `offset` | Paginated bet list |
| GET | `/api/summary` | `startDate`, `endDate` | Aggregated metrics |
| GET | `/api/daily-breakdown` | `startDate`, `endDate` | Per-day inflow/outflow |
| POST | `/api/refresh` | — | Clear local cache |
| GET | `/api/export/csv` | `startDate`, `endDate` | Download CSV |

---

## Key Constraints & Gotchas

- **Graph API key required:** Get a free key at https://thegraph.com/studio. Store as `GRAPH_API_KEY` in `backend/.env`, never commit it.
- **Cursor pagination, not skip:** Use `id_gt: lastId` for walking through large result sets. `skip` degrades badly past 5,000 records.
- **Token decimals vary:** Always divide raw `amount`/`payout` by `10 ** Number(gameToken.decimals)`. USDC and USDT on Polygon both use 6 decimals; BETS token may differ.
- **Case-insensitive IDs:** The Graph stores addresses in lowercase. Pass `storeId.toLowerCase()` when querying by ID.
- **Pending bets:** `status: Pending` means the bet was placed but not yet resolved. Exclude from payout ratio and inflow/outflow sums.
- **Multi-game totals:** Daily totals must be summed across all game types. `GameTokenDayData` has one row per game-token-day combination, so group by date and sum.
- **Polygonscan is verification only:** Use it to confirm 5–10 transaction hashes are correct, not for data fetching.

---

## Deployment (Optional)

### Frontend → Vercel

```bash
cd frontend && npm run build
# Connect repo in Vercel; set VITE_API_URL to your backend URL
```

Update `src/api/client.ts`:
```typescript
const BASE = import.meta.env.VITE_API_URL ?? '/api';
```

### Backend → Render

- Build: `npm install && npm run build`
- Start: `node dist/index.js`
- Env vars: `GRAPH_API_KEY`, `GRAPH_SUBGRAPH_ID`, `CASINO_STORE_ADDRESS`, `PORT`
- Add a Render Disk at `/data` if using SQLite cache; set `DB_PATH=/data/cache.db`

---

## Success Criteria Checklist

- [ ] Dashboard loads and shows real BetSwirl bet data from The Graph
- [ ] Summary metrics (inflows, outflows, net, payout ratio) are correct (spot-checked against Polygonscan)
- [ ] At least 30 days of data with no gaps
- [ ] Date range filter works correctly
- [ ] CSV export downloads a valid file
- [ ] Responsive on mobile
- [ ] README explains setup in under 5 minutes
- [ ] `FINDINGS.md` contains research memo with payout ratio analysis per game type
- [ ] All secrets are in `.env` (never committed)
- [ ] `npm run build` succeeds in both `backend/` and `frontend/`
