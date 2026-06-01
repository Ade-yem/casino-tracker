# Casino House Wallet Flow Tracker — CLAUDE.md

## Project Overview

A full-stack blockchain analytics dashboard that tracks and visualizes the cash flows (deposits, withdrawals, net position) of an on-chain crypto casino operator's hot wallet(s) on Polygon. Primary target: **BetSwirl on Polygon**.

The stack is:
- **Backend:** Node.js + TypeScript, Express, SQLite (via `better-sqlite3`), `viem` v2+
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Recharts
- **Data sources:** Polygonscan API (primary), Alchemy/Infura RPC (secondary)

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
│   ├── src/
│   │   ├── index.ts               # Express server entry point
│   │   ├── db/
│   │   │   ├── schema.ts          # SQLite schema definitions
│   │   │   └── client.ts          # better-sqlite3 singleton
│   │   ├── api/
│   │   │   ├── polygonscan.ts     # Polygonscan API client
│   │   │   └── rpc.ts             # viem publicClient setup
│   │   ├── services/
│   │   │   ├── sync.ts            # Transaction fetch + cache logic
│   │   │   └── aggregator.ts      # Metrics computation (inflows, outflows, ratios)
│   │   └── routes/
│   │       ├── transactions.ts    # GET /api/transactions
│   │       ├── summary.ts         # GET /api/summary
│   │       ├── dailyBreakdown.ts  # GET /api/daily-breakdown
│   │       ├── refresh.ts         # POST /api/refresh
│   │       └── exportCsv.ts       # GET /api/export/csv
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
- npm 9+ or yarn
- A free Polygonscan API key: https://polygonscan.com/apis
- (Optional) A free Alchemy or Infura RPC URL for Polygon

### 1. Clone & Branch

```bash
git clone https://github.com/ade-yem/casino-tracker.git
cd casino-tracker
git checkout -b claude/claude-md-setup-plan-O57EJ
```

### 2. Environment Variables

Copy `.env.example` to `.env` in both the root and `backend/` directories:

```bash
cp .env.example backend/.env
```

`.env.example` contents:

```
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
POLYGON_RPC_URL=https://polygon-rpc.com         # or Alchemy/Infura URL
CASINO_WALLET_ADDRESS=                           # BetSwirl hot wallet address
PORT=3001
```

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
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

Work through the phases in order. Each phase has clear acceptance criteria before moving on.

---

### Phase 1 — Research & Wallet Identification (2–3 hours)

**Goal:** Identify BetSwirl's primary hot wallet address on Polygon.

Steps:
1. Visit https://polygonscan.com and search for "BetSwirl"
2. Check BetSwirl's documentation or GitHub for contract addresses
3. Look for the `Bank` or `BankRoll` contract — this is the wallet that receives player deposits and pays out winnings
4. Verify: the address should show high-volume USDC/USDT transfer activity
5. Record the address in `.env` as `CASINO_WALLET_ADDRESS`

Known token contract addresses on Polygon:
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- USDT: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`

**Acceptance criteria:** You have a wallet address, have manually confirmed 5+ transactions on Polygonscan, and added it to `.env`.

---

### Phase 2 — Backend Scaffold (1–2 hours)

**Goal:** Working Express server with SQLite schema and placeholder routes.

#### 2.1 Init backend

```bash
mkdir backend && cd backend
npm init -y
npm install express better-sqlite3 viem axios dotenv cors
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

```typescript
export const CREATE_TRANSACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS transactions (
    hash        TEXT PRIMARY KEY,
    from_addr   TEXT NOT NULL,
    to_addr     TEXT NOT NULL,
    amount      TEXT NOT NULL,        -- raw value as string (wei/token units)
    amount_usd  REAL,                 -- human-readable decimal
    token       TEXT NOT NULL,        -- 'USDC' | 'USDT'
    direction   TEXT NOT NULL,        -- 'inflow' | 'outflow'
    block_number INTEGER NOT NULL,
    timestamp   INTEGER NOT NULL      -- UNIX seconds
  )
`;

export const CREATE_SYNC_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_state (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_block      INTEGER NOT NULL DEFAULT 0,
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

// Routes (stub imports until Phase 3)
app.get('/api/transactions', (req, res) => res.json({ data: [] }));
app.get('/api/summary', (req, res) => res.json({}));
app.get('/api/daily-breakdown', (req, res) => res.json([]));
app.post('/api/refresh', (req, res) => res.json({ status: 'ok' }));
app.get('/api/export/csv', (req, res) => res.sendStatus(200));

initDb();
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
```

**Acceptance criteria:** `npm run dev` starts without errors; `curl http://localhost:3001/api/summary` returns `{}`.

---

### Phase 3 — Polygonscan API Client & Transaction Sync (4–5 hours)

**Goal:** Fetch all USDC/USDT transfers to/from the casino wallet and cache them in SQLite.

#### 3.1 Polygonscan client (`src/api/polygonscan.ts`)

Key endpoint used:

```
GET https://api.polygonscan.com/api
  ?module=account
  &action=tokentx
  &contractaddress=<TOKEN_ADDRESS>
  &address=<CASINO_WALLET>
  &startblock=0
  &endblock=99999999
  &sort=asc
  &apikey=<KEY>
```

Implementation notes:
- Paginate using `offset` + `page` params (max 10,000 records per call)
- Retry on HTTP 429 with 2 s exponential backoff (max 4 retries)
- Respect the 5 req/sec rate limit: add a 250 ms inter-request delay
- Return a typed `PolygonscanTransfer[]` array

```typescript
export interface PolygonscanTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;         // raw token units
  tokenDecimal: string;
  tokenSymbol: string;
  blockNumber: string;
  timeStamp: string;     // UNIX string
}
```

#### 3.2 Sync service (`src/services/sync.ts`)

Logic:
1. Read `last_block` from `sync_state` (default 0 = full history)
2. Call `fetchTokenTransfers(casinoWallet, startBlock, 'USDC')` and `fetchTokenTransfers(casinoWallet, startBlock, 'USDT')`
3. For each transfer, determine `direction`:
   - `to_addr.toLowerCase() === casinoWallet.toLowerCase()` → `'inflow'`
   - `from_addr.toLowerCase() === casinoWallet.toLowerCase()` → `'outflow'`
4. Compute `amount_usd = Number(value) / 10 ** Number(tokenDecimal)`
5. Upsert into `transactions` (use `INSERT OR IGNORE` to skip duplicates)
6. Update `sync_state` with the highest block number seen and current timestamp

#### 3.3 Wire `POST /api/refresh`

Call `runSync()` and return `{ synced: N, lastBlock: M }`.

**Acceptance criteria:** After calling `POST /api/refresh`, SQLite contains real transactions. Spot-check 3 hashes against Polygonscan UI.

---

### Phase 4 — Aggregation Service & API Routes (2–3 hours)

**Goal:** Compute metrics and serve them via the API.

#### 4.1 Aggregator (`src/services/aggregator.ts`)

Functions to implement:

```typescript
// Returns { totalInflows, totalOutflows, netPosition, payoutRatio, txCount }
function getSummary(startTs?: number, endTs?: number): SummaryMetrics

// Returns [{ date: 'YYYY-MM-DD', inflow: number, outflow: number, net: number }]
function getDailyBreakdown(startTs?: number, endTs?: number): DailyBreakdown[]

// Returns the top N transactions sorted by amount_usd desc
function getLargestTransactions(direction: 'inflow' | 'outflow', limit: number): Transaction[]

// Returns all transactions within date range
function getTransactions(startTs?: number, endTs?: number, limit?: number, offset?: number): Transaction[]
```

Implementation notes:
- All amounts stored as `amount_usd REAL` — sum directly in SQL with `SUM(amount_usd)`
- `payoutRatio = totalOutflows / totalInflows` (express as percentage)
- Date grouping: `strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch'))` in SQLite
- Accept optional `startDate`/`endDate` query params (ISO strings), convert to UNIX timestamps

#### 4.2 Routes

Wire up real implementations:

- `GET /api/transactions?startDate=&endDate=&limit=&offset=`
- `GET /api/summary?startDate=&endDate=`
- `GET /api/daily-breakdown?startDate=&endDate=`
- `GET /api/export/csv` — stream CSV using `papaparse` or manual header construction

**Acceptance criteria:** `curl http://localhost:3001/api/summary` returns real numbers matching what you'd compute manually from the SQLite table.

---

### Phase 5 — Frontend Scaffold (1–2 hours)

**Goal:** Working Vite + React + Tailwind project with routing to a single Dashboard page.

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite recharts date-fns papaparse
npm install -D @types/papaparse
```

`vite.config.ts` — proxy API calls to the backend:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

`tailwind.config.ts`:

```typescript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`src/types/index.ts` — shared interfaces used across components:

```typescript
export interface Transaction {
  hash: string;
  from_addr: string;
  to_addr: string;
  amount_usd: number;
  token: 'USDC' | 'USDT';
  direction: 'inflow' | 'outflow';
  block_number: number;
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

**Acceptance criteria:** `npm run dev` shows default Vite page at `localhost:5173` with no console errors.

---

### Phase 6 — Frontend Components (4–5 hours)

Build components in this order (each is independently testable with mock data first).

#### 6.1 `src/api/client.ts`

```typescript
const BASE = '/api';

export async function fetchSummary(startDate?: string, endDate?: string) { ... }
export async function fetchDailyBreakdown(startDate?: string, endDate?: string) { ... }
export async function fetchTransactions(params: {...}) { ... }
export async function triggerRefresh() { ... }
```

#### 6.2 `SummaryCards.tsx`

Four cards side-by-side (responsive grid):
- Total Inflows (green)
- Total Outflows (red)
- Net Position (green if positive, red if negative)
- Payout Ratio (displayed as `XX.X%`)

Format large numbers with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.

#### 6.3 `TransactionChart.tsx`

Two tabs/toggle:
1. **Daily Flow** — `BarChart` (Recharts) with stacked inflow/outflow bars per day
2. **Cumulative Net** — `LineChart` of running net position over time

Key Recharts components: `ResponsiveContainer`, `BarChart`/`LineChart`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `Bar`/`Line`.

Color scheme: inflows = `#22c55e` (green-500), outflows = `#ef4444` (red-500), net = `#3b82f6` (blue-500).

#### 6.4 `TransactionTable.tsx`

Columns: Date, Hash (truncated, links to `https://polygonscan.com/tx/{hash}`), Direction, Token, Amount (USD).

Features:
- Sort by Amount (default: descending)
- Filter by direction (All / Inflows / Outflows)
- Pagination (25 rows per page)
- Hash display: first 6 + `...` + last 4 chars, opens Polygonscan in new tab

#### 6.5 `DateRangeSelector.tsx`

Two `<input type="date">` fields (Start / End). Presets: Last 7 days, Last 30 days, Last 90 days. On change, call parent `onDateRangeChange(startDate, endDate)`.

#### 6.6 `ExportButton.tsx`

Single button: `Export CSV`. On click, `window.open('/api/export/csv?startDate=...&endDate=...', '_blank')`. No additional library needed.

#### 6.7 `Dashboard.tsx` (main layout)

```tsx
export default function Dashboard() {
  const [dateRange, setDateRange] = useState({ start: '...', end: '...' });
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyBreakdown[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // fetch all three endpoints when dateRange changes
  }, [dateRange]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1>BetSwirl Wallet Tracker</h1>
      <DateRangeSelector ... />
      <SummaryCards ... />
      <TransactionChart ... />
      <TransactionTable ... />
      <ExportButton ... />
    </main>
  );
}
```

**Acceptance criteria:** Dashboard renders all four summary metrics, a chart with daily bars, and a paginated transaction table — all populated from the live backend.

---

### Phase 7 — Testing & Validation (2–3 hours)

Manual spot-check checklist:
- [ ] Pick 5 random transaction hashes from the table; verify amount and direction on Polygonscan
- [ ] Compare `Total Inflows` (30-day) to a manual Polygonscan CSV export sum
- [ ] Confirm `Payout Ratio` = `totalOutflows / totalInflows` — calculate independently
- [ ] Test date range filter: narrow to 1 day and verify counts match Polygonscan
- [ ] Test `POST /api/refresh` with a fresh DB — confirm full sync completes without 429 errors
- [ ] Resize browser to mobile width — all cards and charts should remain readable

Edge cases to handle:
- Empty response from Polygonscan (new wallet, no activity): show "No data" state
- API key missing or invalid: return 500 with clear error message
- `totalInflows === 0` → `payoutRatio = 0` (guard against division by zero)
- Transactions with identical hashes (re-org): `INSERT OR IGNORE` handles this

---

### Phase 8 — Documentation & Polish (2–3 hours)

#### 8.1 README.md (root)

Sections:
1. **What this is** — 2-sentence description
2. **Live demo** — link if deployed
3. **Setup** — copy from Phase 2 above (condensed)
4. **Architecture** — ASCII diagram from PRD §7.1
5. **Key findings** — brief research memo (see below)
6. **Tech stack** — bullet list

#### 8.2 Research Findings Memo

After running the tracker on 30–90 days of BetSwirl data, write a 1-page memo answering:
- What was the observed payout ratio over the period?
- Does it align with BetSwirl's published RTP/house edge claims?
- What is the net position trend — is the house consistently profitable?
- Any notable anomalies (single large payout, sudden inflow spike)?

Save as `FINDINGS.md` in the root.

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
| GET | `/api/transactions` | `startDate`, `endDate`, `limit`, `offset` | Paginated transaction list |
| GET | `/api/summary` | `startDate`, `endDate` | Aggregated metrics |
| GET | `/api/daily-breakdown` | `startDate`, `endDate` | Per-day inflow/outflow |
| POST | `/api/refresh` | — | Trigger Polygonscan sync |
| GET | `/api/export/csv` | `startDate`, `endDate` | Download CSV |

---

## Key Constraints & Gotchas

- **Polygonscan rate limit:** 5 req/sec on free tier. Always add a 250 ms delay between paginated calls. If you get a 429, back off 2 s before retrying.
- **Token decimals:** USDC on Polygon uses 6 decimals, USDT uses 6 decimals. Always divide raw `value` by `10 ** tokenDecimal`.
- **Direction classification:** Compare addresses case-insensitively (`.toLowerCase()`).
- **Pagination:** Polygonscan returns max 10,000 records per call. Use `page` + `offset` to walk through history. Stop when the result count is less than the page size.
- **Block timestamp vs. wall clock:** Always use `timeStamp` from Polygonscan (= `block.timestamp`), not the current time.
- **SQLite concurrency:** `better-sqlite3` is synchronous — this is fine for a single-process backend. Do not use `sqlite3` (async) to avoid WAL confusion.
- **CORS:** The Vite dev server proxy handles this in development. In production, set `cors({ origin: 'https://your-frontend.vercel.app' })`.

---

## Deployment (Optional)

### Frontend → Vercel

```bash
cd frontend && npm run build
# Push to GitHub; connect repo in Vercel dashboard
# Set VITE_API_URL env var to your backend URL
```

Update `src/api/client.ts` to use `import.meta.env.VITE_API_URL` as the base URL.

### Backend → Render

- Create a new Web Service on Render, point to `backend/`
- Build command: `npm install && npm run build`
- Start command: `node dist/index.js`
- Add env vars: `POLYGONSCAN_API_KEY`, `CASINO_WALLET_ADDRESS`, `POLYGON_RPC_URL`
- Add a Render Disk at `/data` for SQLite persistence; update `DB_PATH` env var

---

## Success Criteria Checklist

- [ ] Dashboard loads and shows real BetSwirl transaction data
- [ ] Summary metrics (inflows, outflows, net, payout ratio) are correct (spot-checked vs. Polygonscan)
- [ ] At least 30 days of data with no gaps
- [ ] Date range filter works correctly
- [ ] CSV export downloads a valid file
- [ ] Responsive on mobile
- [ ] README explains setup in under 5 minutes
- [ ] `FINDINGS.md` contains research memo with payout ratio analysis
- [ ] All secrets are in `.env` (never committed)
- [ ] `npm run build` succeeds in both `backend/` and `frontend/`
