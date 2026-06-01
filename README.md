# Casino House Wallet Flow Tracker

A full-stack blockchain analytics dashboard that tracks and visualizes the cash flows of BetSwirl's on-chain casino on Polygon. Pulls verified, game-level bet data from The Graph and surfaces key operator metrics: total inflows, outflows, house net position, and payout ratio — all verifiable against on-chain transaction hashes.

## Live Demo

> Deploy to Vercel (frontend) + Render (backend) — see [Deployment](#deployment) below.

---

## Architecture

```
┌─────────────────────────────────────┐
│   React Frontend (Vite + Tailwind)   │
│  Dashboard · Charts · Table · Export │
└──────────────┬──────────────────────┘
               │ /api/*  (proxied in dev)
┌──────────────▼──────────────────────┐
│  Node.js Backend (Express + TypeScript) │
│  • The Graph query client            │
│  • Aggregation (sum, payout ratio)   │
│  • Optional SQLite write-through cache│
│  • REST API routes                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  The Graph — BetSwirl Polygon        │
│  Subgraph deployment:                │
│  QmUa6b7voVS4kuERGo3bEDvRsW2Fd...   │
└─────────────────────────────────────┘
```

**Why The Graph instead of Polygonscan API?**

| | Polygonscan | The Graph |
|---|---|---|
| Data model | Raw ERC-20 transfers | Structured game-level bets |
| Rate limit | 5 req/sec | ~1,000 req/min |
| Payout data | Not available | `payout` field per bet |
| Resolution status | No | `resolved` boolean per bet |

---

## Setup

### Prerequisites

- Node.js 18+
- A free Graph API key — create one at [thegraph.com/studio](https://thegraph.com/studio) → **API Keys**

### 1. Clone

```bash
git clone https://github.com/ade-yem/casino-tracker.git
cd casino-tracker
```

### 2. Configure environment

```bash
cp .env.example backend/.env
```

Edit `backend/.env` and set your Graph API key:

```bash
GRAPH_API_KEY=your_key_here
```

The Bank contract and subgraph deployment ID are already filled in — confirmed from the BetSwirl SDK source.

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run in development

```bash
# Terminal 1 — backend (port 3001)
cd backend && npm run dev

# Terminal 2 — frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## API Reference

All endpoints served by the backend on port 3001.

| Method | Endpoint | Params | Description |
|--------|----------|--------|-------------|
| GET | `/health` | — | Liveness check |
| GET | `/api/summary` | `startDate`, `endDate`, `allTime` | Aggregated metrics |
| GET | `/api/daily-breakdown` | `startDate`, `endDate` | Per-day inflow/outflow/net |
| GET | `/api/transactions` | `startDate`, `endDate`, `limit`, `offset` | Paginated bet list |
| POST | `/api/refresh` | — | Clear SQLite cache |
| GET | `/api/export/csv` | `startDate`, `endDate` | Download all bets as CSV |

Date params accept ISO strings (`2024-01-01`). Default range: last 30 days.

Pass `?allTime=true` to `/api/summary` to use the Bank entity's cumulative totals (one query, instant).

---

## How the Data Works

BetSwirl's on-chain bets are indexed by The Graph into a unified `Bet` entity. Each bet has:

- `betAmount` — amount per roll (raw token units)
- `betCount` — number of rolls in the transaction
- `totalBetAmount` — actual total wagered after resolution (authoritative)
- `payout` — total returned to the player (0 if the player lost)
- `resolved` — boolean; `false` while the Chainlink VRF result is pending
- `betTimestamp` / `rollTimestamp` — when placed / when resolved

**Inflow** = `totalBetAmount` (what the casino received)  
**Outflow** = `payout` (what the casino returned)  
**Net position** = Inflows − Outflows  
**Payout ratio** = Outflows ÷ Inflows

Pending bets (`resolved: false`) are excluded from all metrics — only settled outcomes count.

### Verifying a transaction

Every bet in the table links to `https://polygonscan.com/tx/{rollTxnHash}`. Cross-check the amount and payout against the on-chain event log for any row.

---

## Schema Verification

To inspect the live subgraph schema and pull a sample bet:

```bash
cd backend
npx ts-node src/scripts/introspect.ts
```

This prints all entity types, their fields, and one live bet — useful for confirming field names if the subgraph is upgraded.

---

## Tech Stack

**Backend**
- Node.js 18 + TypeScript
- Express — REST API
- `axios` — The Graph HTTP client
- `better-sqlite3` — optional write-through cache

**Frontend**
- React 18 + TypeScript
- Vite + Tailwind CSS v4
- Recharts — bar and line charts
- `date-fns` — date formatting

**Data**
- [The Graph](https://thegraph.com) — BetSwirl Polygon subgraph  
  Deployment: `QmUa6b7voVS4kuERGo3bEDvRsW2FdTogSLeztnvtsi5DB2`
- BetSwirl Bank contract (Polygon): `0x8FB3110015FBCAA469ee45B64dcd2BdF544B9CFA`

---

## Deployment

### Frontend → Vercel

```bash
cd frontend && npm run build
```

Push to GitHub and connect the repo in Vercel. Set the environment variable:

```
VITE_API_URL=https://your-backend.onrender.com/api
```

### Backend → Render

- Build command: `cd backend && npm install && npm run build`
- Start command: `node backend/dist/index.js`
- Environment variables: `GRAPH_API_KEY`, `PORT`
- Add a **Disk** at `/data` for SQLite persistence; set `DB_PATH=/data/cache.db`

---

## Project Structure

```
casino-tracker/
├── .env.example            # copy to backend/.env
├── backend/
│   └── src/
│       ├── api/graph.ts    # The Graph query client (cursor-paginated)
│       ├── config.ts       # env + endpoint configuration
│       ├── db/             # SQLite schema + client
│       ├── routes/         # Express routes (5 endpoints)
│       ├── scripts/        # introspect.ts — live schema verification
│       └── services/       # sync (normalize bets) + aggregator (metrics)
└── frontend/
    └── src/
        ├── api/client.ts   # fetch wrappers
        ├── components/     # Dashboard, SummaryCards, Chart, Table, ...
        └── types/          # shared TypeScript interfaces
```
