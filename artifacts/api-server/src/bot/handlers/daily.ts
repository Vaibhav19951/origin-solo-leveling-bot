import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatCooldown } from "../utils/format";
import { RANK_EMOJIS as RANK_EMOJI_MAP } from "../utils/ranks";

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const RANK_DAILY_GOLD: Record<string, number> = {
  E: 200, D: 400, C: 700, B: 1200, A: 2000, S: 4000, NLH: 7000, Monarch: 15000,
};
const RANK_DAILY_MANA: Record<string, number> = {
  E: 5, D: 10, C: 20, B: 40, A: 80, S: 150, NLH: 300, Monarch: 600,
};

export async function handleDaily(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  // Update lastSeen
  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (hunter.lastDaily) {
    const elapsed = Date.now() - hunter.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN_MS) {
      const remaining = DAILY_COOLDOWN_MS - elapsed;
      await ctx.replyWithHTML(
        `📅 <b>[ SYSTEM ]</b>\nDaily reward already claimed.\n\nNext claim in: <b>${formatCooldown(remaining)}</b>`,
      );
      return;
    }
  }

  const goldReward = RANK_DAILY_GOLD[hunter.rank] || 200;
  const manaReward = RANK_DAILY_MANA[hunter.rank] || 5;
  const rankIdx = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"].indexOf(hunter.rank);
  const bonusGold = Math.floor(goldReward * 0.1 * rankIdx);
  const totalGold = goldReward + bonusGold;
  const rankEmoji = RANK_EMOJI_MAP[hunter.rank] || "⬜";

  await db
    .update(huntersTable)
    .set({
      gold: hunter.gold + totalGold,
      manaCoin: hunter.manaCoin + manaReward,
      hp: hunter.maxHp,
      mp: hunter.maxMp,
      dungeonKeys: hunter.dungeonKeys + 1,
      lastDaily: new Date(),
      lastSeen: new Date(),
    })
    .where(eq(huntersTable.id, hunter.id));

  const msg =
    `📅 <b>DAILY REWARD CLAIMED</b>\n` +
    `${rankEmoji} Rank: <b>${hunter.rank}</b>\n\n` +
    `━━━━━ REWARDS ━━━━━\n` +
    `💰 Gold: <b>+${totalGold.toLocaleString()}</b>${bonusGold > 0 ? ` (+${bonusGold} rank bonus)` : ""}\n` +
    `💎 Mana Coins: <b>+${manaReward}</b>\n` +
    `❤️ HP fully restored: <b>${hunter.maxHp}/${hunter.maxHp}</b>\n` +
    `💙 MP fully restored: <b>${hunter.maxMp}/${hunter.maxMp}</b>\n` +
    `🔑 Dungeon Keys: <b>+1</b> (now ${hunter.dungeonKeys + 1})\n\n` +
    `<i>Come back tomorrow for your next reward!</i>`;

  await ctx.replyWithHTML(msg, {
    reply_markup: {
      inline_keyboard: [[
        { text: "⚔️ Hunt Now", callback_data: "action_hunt" },
        { text: "🏰 Dungeon", callback_data: "action_dungeon" },
      ]],
    },
  });
}
