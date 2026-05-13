import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getXpForLevel } from "../utils/ranks";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handleStart(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const telegramId = String(user.id);
  const existing = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, telegramId));

  if (existing.length > 0) {
    const h = existing[0];
    await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, h.id));
    await ctx.replyWithHTML(
      `🌑 <b>Welcome back, ${h.firstName || user.first_name}.</b>\n\n` +
        `${RANK_EMOJIS[h.rank] || "⬜"} Rank: <b>${h.rank}</b>  |  Lv.<b>${h.level}</b>\n` +
        `💰 Gold: <b>${h.gold}</b>  |  💎 Mana: <b>${h.manaCoin}</b>\n\n` +
        `The System remembers you.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚔️ Hunt", callback_data: "action_hunt" },
              { text: "🗺️ Map", callback_data: "action_map" },
            ],
            [
              { text: "📊 Profile", callback_data: "action_profile" },
              { text: "💎 Premium", callback_data: "action_premium" },
            ],
          ],
        },
      },
    );
    return;
  }

  const xpToNext = getXpForLevel(1);
  await db.insert(huntersTable).values({
    telegramId,
    username: user.username || null,
    firstName: user.first_name,
    rank: "E",
    level: 1,
    xp: 0,
    xpToNextLevel: xpToNext,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    strength: 10,
    agility: 8,
    intelligence: 6,
    perception: 7,
    gold: 500,
    manaCoin: 0,
    dungeonKeys: 3,
    statPoints: 0,
    location: "Cartenon Temple",
    lastSeen: new Date(),
  });

  const welcomeMsg =
    `╔══════════════════════════╗\n` +
    `║   ⚠  SYSTEM NOTICE  ⚠   ║\n` +
    `╚══════════════════════════╝\n\n` +
    `<b>A new hunter has been detected.</b>\n\n` +
    `Hunter: <b>${user.first_name}</b>\n` +
    `Rank: <b>E</b> (Provisional)\n` +
    `Location: <b>Cartenon Temple</b>\n` +
    `Status: <b>AWAKENED</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎁 <b>Starting Package:</b>\n` +
    `💰 500 Gold  |  💎 0 Mana Coins\n` +
    `🔑 3 Dungeon Keys\n` +
    `❤️ 100 HP  |  💙 50 MP\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>New Features:</b>\n` +
    `🗺️ Live World Map — see online hunters\n` +
    `⚔️ PvP — challenge real players\n` +
    `💱 Trade — send mana coins & gold\n` +
    `💎 Premium — unlock mythic characters\n\n` +
    `<i>"I alone level up."</i>`;

  try {
    await ctx.replyWithPhoto(
      { url: "https://upload.wikimedia.org/wikipedia/en/2/2e/Solo_leveling_manhwa_cover.jpg" },
      {
        caption: welcomeMsg,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚔️ Start Hunting!", callback_data: "action_hunt" },
              { text: "🗺️ World Map", callback_data: "action_map" },
            ],
            [
              { text: "💎 Premium Shop", callback_data: "action_premium" },
              { text: "❓ Help", callback_data: "action_help" },
            ],
          ],
        },
      },
    );
  } catch {
    await ctx.replyWithHTML(welcomeMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⚔️ Start Hunting!", callback_data: "action_hunt" },
            { text: "🗺️ World Map", callback_data: "action_map" },
          ],
          [{ text: "💎 Premium Shop", callback_data: "action_premium" }],
        ],
      },
    });
  }
}
