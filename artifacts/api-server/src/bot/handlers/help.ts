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

  if (hunter) {
    await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));
  }

  const rankInfo = hunter
    ? `${RANK_EMOJIS[hunter.rank] || "⬜"} Rank <b>${hunter.rank}</b>  |  Lv.<b>${hunter.level}</b>  |  💎<b>${hunter.manaCoin}</b> MC\n\n`
    : "";

  await ctx.replyWithHTML(
    `🌑 <b>SOLO LEVELING RPG</b> 🌑\n` +
    `<i>Rise. Hunt. Become the Shadow Monarch.</i>\n\n` +
    rankInfo +
    `━━━━━ COMBAT ━━━━━\n` +
    `/hunt — Fight monsters (no cooldown!)\n` +
    `/dungeon — Enter a dungeon gate 🔑\n` +
    `/dungeons — List available dungeons\n\n` +
    `━━━━━ WORLD MAP ━━━━━\n` +
    `/map — See live world map & online hunters\n` +
    `/move [zone] — Travel to a zone\n\n` +
    `━━━━━ PvP & TRADE ━━━━━\n` +
    `/pvp @username [bet] — Challenge a hunter\n` +
    `/trade @username [amount] [mana/gold] — Send resources\n\n` +
    `━━━━━ HUNTER ━━━━━\n` +
    `/profile — View your stats\n` +
    `/allocate [stat] [n] — Spend stat points\n` +
    `/rest — Recover HP\n` +
    `/daily — Daily rewards (24h)\n\n` +
    `━━━━━ ITEMS ━━━━━\n` +
    `/inventory — Your items\n` +
    `/use [item] — Use a potion\n` +
    `/shop — Browse the shop\n` +
    `/buy [item] — Purchase item\n` +
    `/sell [item] — Sell item (50% value)\n\n` +
    `━━━━━ PREMIUM ━━━━━\n` +
    `/premium — Mythic character shop 💎\n` +
    `/buy_premium [id] — Unlock a character\n\n` +
    `━━━━━ RANKINGS ━━━━━\n` +
    `/rank — Hunter leaderboard\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⬜E → 🟩D → 🟦C → 🟪B → 🟧A → 🟥S → ⭐NLH → 👑Monarch\n\n` +
    `<i>"I alone level up."</i>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⚔️ Hunt", callback_data: "action_hunt" },
            { text: "🗺️ World Map", callback_data: "action_map" },
          ],
          [
            { text: "📊 Profile", callback_data: "action_profile" },
            { text: "💎 Premium", callback_data: "action_premium" },
          ],
          [
            { text: "🏪 Shop", callback_data: "action_shop" },
            { text: "🏆 Rankings", callback_data: "action_rank" },
          ],
        ],
      },
    },
  );
}
