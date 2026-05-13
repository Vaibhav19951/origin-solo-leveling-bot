import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatCooldown } from "../utils/format";
import { RANK_EMOJIS as RANK_EMOJI_MAP } from "../utils/ranks";

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const RANK_DAILY_GOLD: Record<string, number> = {
  E: 200,
  D: 400,
  C: 700,
  B: 1200,
  A: 2000,
  S: 4000,
  NLH: 7000,
  Monarch: 15000,
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

  if (hunter.lastDaily) {
    const elapsed = Date.now() - hunter.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN_MS) {
      const remaining = DAILY_COOLDOWN_MS - elapsed;
      await ctx.replyWithHTML(
        `📅 <b>[ SYSTEM ]</b>\nDaily reward already claimed.\n\nNext claim available in: <b>${formatCooldown(remaining)}</b>`,
      );
      return;
    }
  }

  const goldReward = RANK_DAILY_GOLD[hunter.rank] || 200;
  const hpRestore = hunter.maxHp;
  const mpRestore = hunter.maxMp;
  const dungeonKeyBonus = 1;

  // Bonus based on rank
  const rankIdx = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"].indexOf(hunter.rank);
  const bonusGold = Math.floor(goldReward * 0.1 * rankIdx);

  const totalGold = goldReward + bonusGold;
  const rankEmoji = RANK_EMOJI_MAP[hunter.rank] || "⬜";

  await db
    .update(huntersTable)
    .set({
      gold: hunter.gold + totalGold,
      hp: hpRestore,
      mp: mpRestore,
      dungeonKeys: hunter.dungeonKeys + dungeonKeyBonus,
      lastDaily: new Date(),
    })
    .where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `📅 <b>DAILY REWARD CLAIMED</b>\n` +
    `${rankEmoji} Rank: <b>${hunter.rank}</b>\n\n` +
    `━━━━━ REWARDS ━━━━━\n` +
    `💰 Gold: <b>+${totalGold.toLocaleString()}</b>${bonusGold > 0 ? ` (includes rank bonus +${bonusGold})` : ""}\n` +
    `❤️ HP fully restored: <b>${hpRestore}/${hpRestore}</b>\n` +
    `💙 MP fully restored: <b>${mpRestore}/${mpRestore}</b>\n` +
    `🔑 Dungeon Keys: <b>+${dungeonKeyBonus}</b> (now ${hunter.dungeonKeys + dungeonKeyBonus})\n\n` +
    `<i>The System rewards disciplined hunters.</i>\n` +
    `Come back tomorrow for your next reward!`,
  );
}
