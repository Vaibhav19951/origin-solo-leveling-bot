# Solo Leveling RPG Bot

A Telegram RPG bot themed around Solo Leveling — hunt monsters, clear dungeons, level up, and climb from E-Rank to Shadow Monarch.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Telegram bot (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `TELEGRAM_BOT_TOKEN` — Telegram bot token from @BotFather

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Telegram: Telegraf v4 (long polling)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/bot/` — all bot logic
  - `bot/handlers/` — command handlers (start, hunt, dungeon, shop, etc.)
  - `bot/data/` — game data (monsters, items, dungeons)
  - `bot/utils/` — combat engine, rank system, message formatting
  - `bot/index.ts` — Telegraf bot setup, command registration
- `lib/db/src/schema/` — DB schema (hunters, items, inventory, huntLog)
- `artifacts/api-server/src/index.ts` — Express + bot startup

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Register as a Hunter |
| `/profile` or `/me` | View hunter stats |
| `/hunt` | Fight a monster (5-min cooldown) |
| `/dungeon [rank]` | Enter a dungeon gate (costs 1 key) |
| `/dungeons` | List available dungeons |
| `/daily` | Claim daily gold, HP restore, key |
| `/rest` | Recover 50% of missing HP (free) |
| `/inventory` or `/inv` | View your items |
| `/use [item]` | Use a potion |
| `/shop` | Browse the shop |
| `/buy [item]` | Purchase an item |
| `/sell [item]` | Sell an item (50% value) |
| `/allocate [stat] [n]` | Spend stat points (str/agi/int/per/hp) |
| `/rank` | Leaderboard |
| `/help` | Show all commands |

## Game Mechanics

- **Ranks:** E → D → C → B → A → S → National Level Hunter → Shadow Monarch
- **Rank promotions** happen automatically at specific levels
- **Combat:** Turn-based simulation comparing STR vs monster strength
- **Dungeons:** Multi-wave fights ending in a boss, consumes 1 dungeon key
- **Daily rewards** scale with hunter rank
- **Stat points** awarded every level up; allocate freely

## Architecture decisions

- Bot runs alongside the Express server in the same Node.js process
- Long polling mode (no webhook) — simple, works in dev and production
- Items seeded on-demand (inserted to DB on first purchase/drop)
- All game state stored in PostgreSQL via Drizzle ORM
- Combat is deterministic-ish: random multipliers ±15% for excitement

## User preferences

- Solo Leveling theme throughout — "System" message style, rank names, monster names
- Dynamic and decorative message formatting with box-drawing characters and emojis
