import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatHunterProfile } from "../utils/format";
import { PREMIUM_CHARACTERS } from "../data/premium";

export async function handleProfile(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(
      `⚠️ <b>[ SYSTEM ]</b>\nNo hunter record found.\nUse /start to register.`,
    );
    return;
  }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const premChar = hunter.premiumCharacter
    ? PREMIUM_CHARACTERS.find((c) => c.id === hunter.premiumCharacter)
    : null;

  let msg = formatHunterProfile(hunter);

  if (premChar) {
    msg += `\n\n💎 <b>MYTHIC CHARACTER:</b> ${premChar.emoji} ${premChar.name}\n${premChar.specialAbility}`;
  }

  msg += `\n\n💎 Mana Coins: <b>${hunter.manaCoin.toLocaleString()} MC</b>`;
  msg += `\n📍 Location: <b>${hunter.location}</b>`;
  msg += `\n⚔️ PvP: <b>${hunter.pvpWins}W / ${hunter.pvpLosses}L</b>`;

  await ctx.replyWithHTML(msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚔️ Hunt", callback_data: "action_hunt" },
          { text: "🏰 Dungeon", callback_data: "action_dungeon" },
        ],
        [
          { text: "🗺️ World Map", callback_data: "action_map" },
          { text: "👊 Find PvP", callback_data: "action_pvp_list" },
        ],
        [
          { text: "🎒 Inventory", callback_data: "action_inventory" },
          { text: "🏪 Shop", callback_data: "action_shop" },
        ],
        [
          { text: "💎 Premium Shop", callback_data: "action_premium" },
          { text: "📅 Daily", callback_data: "action_daily" },
        ],
      ],
    },
  });
}
