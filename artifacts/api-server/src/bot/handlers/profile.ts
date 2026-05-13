import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatHunterProfile } from "../utils/format";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handleProfile(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(
      `⚠️ <b>[ SYSTEM ]</b>\nNo hunter record found.\nUse /start to register as a hunter.`,
    );
    return;
  }

  const rankEmoji = RANK_EMOJIS[hunter.rank] || "⬜";
  const msg = formatHunterProfile(hunter);

  await ctx.replyWithHTML(msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚔️ Hunt", callback_data: "action_hunt" },
          { text: "🏰 Dungeon", callback_data: "action_dungeon" },
        ],
        [
          { text: "🎒 Inventory", callback_data: "action_inventory" },
          { text: "🏪 Shop", callback_data: "action_shop" },
        ],
        [
          { text: "📅 Daily", callback_data: "action_daily" },
          { text: "🏆 Leaderboard", callback_data: "action_rank" },
        ],
      ],
    },
  });
}
