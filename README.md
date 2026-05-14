# ⚔️ Solo Leveling RPG Bot

> A fully-featured Telegram RPG bot themed around **Solo Leveling** — hunt monsters, clear dungeons, build your shadow army, and rise from E-Rank to **Shadow Monarch**.

<div align="center">

![Solo Leveling Banner](screenshots/banner.png)

[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Telegraf](https://img.shields.io/badge/Telegraf-v4-26A5E4?style=for-the-badge&logo=telegram)](https://telegrafjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?style=for-the-badge&logo=postgresql)](https://orm.drizzle.team)

</div>

---

## 📸 Screenshots

<div align="center">

| Combat System | Profile & Stats | Shadow Army |
|:---:|:---:|:---:|
| ![Combat](screenshots/combat.png) | ![Profile](screenshots/profile.png) | ![Shadows](screenshots/shadows.png) |

| Spin Wheel | Premium Shop | Payment Flow |
|:---:|:---:|:---:|
| ![Spin](screenshots/spin.png) | ![Premium](screenshots/premium.png) | ![Payment](screenshots/payment.png) |

</div>

---

## ✨ Features

### ⚔️ Interactive Combat
- **Turn-based fights** with move selection buttons every round
- **5 moves per round:** Strike, Power Strike, Shadow Slash, Guard, Aura Burst
- **Live HP bar** updates after every round
- **Weapon specials** fire in combat (Double Strike, Lifesteal, Berserker, First Strike, etc.)
- Combat sessions expire after 10 minutes

### 🌑 Shadow Army
- Extract shadows from defeated monsters with `/arise`
- Shadows boost combat ATK passively in every fight
- Manage your army with `/shadows`

### 🗡️ Weapon System
- 6 gold weapons in the shop + 4 premium MC weapons
- Equip via `/equip [weapon]`, unequip via `/unequip`
- Weapons drop from `/spin` and dungeons
- Specials: Double Strike, First Strike, Lifesteal, Berserker, Monarch's Decree, Holy Smite

### ✨ Aura System
- 11 auras from Hunter → Shadow Monarch → Absolute
- Each aura gives a unique **Aura Burst** combat move in fights
- Flame → Burning Strike, Shadow → Shadow Wrath, Monarch → Absolute Power (5×), etc.
- Buy from `/aurastore` with Mana Coins

### 🏰 Dungeons & Gates
- Rank-locked dungeons with multi-wave + boss fights
- **Active Gates** system — live gates refresh every 3 hours, 2 per rank
- Enter gates with `/entergate [id]`

### 👥 Teams & Guilds
- Create and manage teams up to 4 hunters
- Full guild system with rank, invite, kick, promote
- Guild leaderboard and stats

### ⚔️ PvP Arena
- Challenge other hunters to ranked battles
- PvP wins tracked on the leaderboard

### 🎰 Spin Wheel
- Free spin every 6 hours, extra spins for 500 MC
- **Weapon drops** integrated: Mythic → Shadow Monarch's Sword, Epic → Rune Spear, etc.
- Prize tiers: Common → Uncommon → Rare → Epic → Legendary → Mythic → **JACKPOT**

### 💎 Premium Characters (Mythic)
- 6 premium characters purchasable with Mana Coins
- **Sung Jin-Woo** (49,900 MC) — 2× XP, +300 STR, ARISE ability
- Thomas Andre, Cha Hae-In, Go Gun-Hee, Choi Jong-In, Baek Yoon-Ho
- Full stat bonuses + XP/Gold multipliers

### 💳 Payment System
- UPI QR code generation per package
- **Owner approval flow** — players tap "I've Paid", owner gets Approve/Reject buttons
- One-tap approval credits Mana Coins and notifies the player automatically

### 🛡️ Owner Admin Panel
Full admin suite — ban/unban users, add gold/mana, set levels, broadcast messages, leaderboard management.

---

## 🤖 Bot Commands

| Category | Command | Description |
|---|---|---|
| **Core** | `/start` | Register as a Hunter |
| | `/profile` `/me` | View hunter stats |
| | `/help` | All commands |
| | `/allocate [stat] [n]` | Spend stat points |
| **Combat** | `/hunt` | Interactive monster fight |
| | `/dungeon [rank]` | Enter a dungeon gate |
| | `/gates` | View all active dungeon gates |
| | `/entergate [id]` | Enter a specific gate |
| **Weapons** | `/equip [weapon]` | Equip a weapon |
| | `/weapons` | View your weapons |
| | `/unequip` | Unequip weapon |
| | `/weaponshop` | Browse premium weapons |
| | `/buyweapon [name]` | Buy with Mana Coins |
| **Shadows** | `/arise` `/extract` | Extract shadow from last kill |
| | `/shadows` `/army` | View shadow army |
| **Aura** | `/aura` | View your aura |
| | `/setaura [name]` | Equip an aura |
| | `/aurastore` | Browse all auras |
| | `/buyaura [name]` | Purchase an aura |
| **Social** | `/team` | Team management |
| | `/guild` | Guild management |
| | `/arena` `/pvp` | PvP challenge |
| | `/rank` | Leaderboard |
| **Economy** | `/daily` | Daily gold + HP + key |
| | `/rest` | Recover 50% HP free |
| | `/shop` | Item shop |
| | `/buy` `/sell` | Buy/sell items |
| | `/inventory` | View inventory |
| | `/spin` | Shadow Lottery (6h cooldown) |
| **Premium** | `/premium` | Mythic character shop |
| | `/payment` | UPI payment portal |
| **Owner** | `/owner` | Admin panel |
| | `/addgold @user [n]` | Add gold |
| | `/addmana @user [n]` | Add Mana Coins |
| | `/setlevel @user [n]` | Set level |
| | `/ban` `/unban` | Ban management |
| | `/broadcast [msg]` | Message all hunters |
| | `/setupi [id] [name]` | Set UPI payment ID |

---

## 🎮 Game Mechanics

### Ranks (Level thresholds)
| Rank | Level | Description |
|---|---|---|
| E | 1–9 | Beginner hunter |
| D | 10–19 | Developing skills |
| C | 20–29 | Competent hunter |
| B | 30–39 | Elite hunter |
| A | 40–49 | Top-tier hunter |
| S | 50–69 | National asset |
| NLH | 70–89 | National Level Hunter |
| **Monarch** | 90+ | Shadow Monarch |

### Combat Formula
- Hunter ATK = `STR × 2.5 + Level × 1.5 + Weapon ATK + Shadow Bonus`
- Monster DMG = `Monster STR × 1.8 − Hunter AGI × 0.5`
- All moves have ±20% variance for excitement

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Bot Framework | Telegraf v4 (long polling) |
| Web Server | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| Build | esbuild |
| Monorepo | pnpm workspaces |

---

## 📁 Project Structure

```
├── artifacts/
│   └── api-server/
│       └── src/
│           ├── bot/
│           │   ├── handlers/      # All command handlers
│           │   │   ├── hunt.ts        # Interactive combat
│           │   │   ├── dungeon.ts     # Dungeons
│           │   │   ├── equip.ts       # Weapon system
│           │   │   ├── aura.ts        # Aura system
│           │   │   ├── shadow.ts      # Shadow army
│           │   │   ├── spin.ts        # Lottery (weapon drops)
│           │   │   ├── premium.ts     # Mythic characters
│           │   │   ├── payment.ts     # UPI payment + approval
│           │   │   ├── guild.ts       # Guild system
│           │   │   ├── team.ts        # Team system
│           │   │   ├── gates.ts       # Active gates
│           │   │   ├── pvp.ts         # PvP arena
│           │   │   └── owner.ts       # Admin commands
│           │   ├── data/
│           │   │   ├── monsters.ts    # Monster definitions
│           │   │   ├── dungeons.ts    # Dungeon definitions
│           │   │   ├── weapons.ts     # Weapon definitions
│           │   │   ├── auras.ts       # Aura definitions
│           │   │   ├── items.ts       # Shop items
│           │   │   └── premium.ts     # Premium character data
│           │   └── utils/
│           │       ├── combatEngine.ts  # Interactive combat logic
│           │       ├── combat.ts        # Dungeon simulation
│           │       ├── ranks.ts         # Rank/level system
│           │       └── format.ts        # Message formatting
│           └── index.ts           # Express + bot startup
└── lib/
    └── db/
        └── src/
            └── schema/            # Drizzle ORM schema
                ├── hunters.ts
                ├── items.ts
                ├── inventory.ts
                ├── guilds.ts
                ├── teams.ts
                ├── shadowArmy.ts
                ├── activeGates.ts
                └── botConfig.ts
```

---

## 🚀 Setup & Deployment

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/solo-leveling-rpg-bot.git
cd solo-leveling-rpg-bot
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Environment variables
Create a `.env` file (or set in your hosting platform):
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
TELEGRAM_BOT_TOKEN=your_bot_token_here
SESSION_SECRET=your_random_secret
```

### 4. Push database schema
```bash
pnpm --filter @workspace/db run push
```

### 5. Run in development
```bash
pnpm --filter @workspace/api-server run dev
```

### 6. Build for production
```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

---

## ⚙️ Owner Setup

After starting the bot, set your payment UPI ID (saved permanently to DB):
```
/setupi yourname@upi YourDisplayName
```

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
  <b>Built with ❤️ inspired by Solo Leveling</b><br>
  <i>"I alone level up."</i>
</div>
