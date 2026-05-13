import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handleRankboard(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const topHunters = await db
    .select()
    .from(huntersTable)
    .orderBy(desc(huntersTable.level), desc(huntersTable.xp))
    .limit(15);

  if (topHunters.length === 0) {
    await ctx.replyWithHTML(`🏆 No hunters registered yet. Be the first — /start`);
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const lines = topHunters.map((h, i) => {
    const rankEmoji = RANK_EMOJIS[h.rank] || "⬜";
    const medal = medals[i] || `<b>${i + 1}.</b>`;
    const name = h.firstName || h.username || `Hunter #${h.id}`;
    return `${medal} ${rankEmoji} <b>${name}</b> — Lv.${h.level} [${h.rank}]  🏆${h.wins}W/${h.losses}L`;
  });

  // Find user's position
  const [currentHunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  let userPos = "";
  if (currentHunter) {
    const allHunters = await db
      .select()
      .from(huntersTable)
      .orderBy(desc(huntersTable.level), desc(huntersTable.xp));
    const pos = allHunters.findIndex((h) => h.id === currentHunter.id) + 1;
    const rankEmoji = RANK_EMOJIS[currentHunter.rank] || "⬜";
    userPos =
      `\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Your rank: <b>#${pos}</b>  ${rankEmoji} Lv.${currentHunter.level} [${currentHunter.rank}]`;
  }

  await ctx.replyWithHTML(
    `🌍 <b>HUNTER ASSOCIATION RANKINGS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    lines.join("\n") +
    userPos,
  );
}
