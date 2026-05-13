import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handleHelp(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  const rankInfo = hunter
    ? `${RANK_EMOJIS[hunter.rank] || "⬜"} Rank <b>${hunter.rank}</b>  |  Level <b>${hunter.level}</b>\n\n`
    : "";

  await ctx.replyWithHTML(
    `🌑 <b>SOLO LEVELING RPG</b> 🌑\n` +
    `<i>Rise. Hunt. Become the Shadow Monarch.</i>\n\n` +
    rankInfo +
    `━━━━━ COMMANDS ━━━━━\n\n` +
    `<b>⚔️ Combat</b>\n` +
    `/hunt — Fight a monster (5 min cooldown)\n` +
    `/dungeon — Enter a dungeon gate (costs 🔑)\n` +
    `/dungeons — List available dungeons\n\n` +
    `<b>👤 Hunter</b>\n` +
    `/profile — View your hunter stats\n` +
    `/allocate — Spend stat points\n` +
    `/rest — Recover HP (free, partial)\n` +
    `/daily — Claim daily rewards (24h)\n\n` +
    `<b>🎒 Items</b>\n` +
    `/inventory — View your items\n` +
    `/use [item] — Use a potion\n` +
    `/shop — Browse the shop\n` +
    `/buy [item] — Purchase an item\n` +
    `/sell [item] — Sell an item (50% value)\n\n` +
    `<b>🏆 Rankings</b>\n` +
    `/rank — Hunter Association leaderboard\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Rank System:</b>\n` +
    `⬜ E → 🟩 D → 🟦 C → 🟪 B → 🟧 A → 🟥 S → ⭐ NLH → 👑 Monarch\n\n` +
    `<i>"I alone level up."</i>`,
  );
}
