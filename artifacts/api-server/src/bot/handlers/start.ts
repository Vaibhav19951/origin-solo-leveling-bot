import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getXpForLevel } from "../utils/ranks";

export async function handleStart(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const telegramId = String(user.id);
  const existing = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, telegramId));

  if (existing.length > 0) {
    await ctx.replyWithHTML(
      `🌑 <b>Welcome back, Hunter ${existing[0].firstName || user.first_name}.</b>\n\n` +
        `The System remembers you.\n` +
        `Rank: <b>${existing[0].rank}</b>  |  Level: <b>${existing[0].level}</b>\n\n` +
        `Use /help to see all commands.`,
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
    dungeonKeys: 3,
    statPoints: 0,
  });

  const welcomeMsg =
    `╔══════════════════════════╗\n` +
    `║   ⚠  SYSTEM NOTICE  ⚠   ║\n` +
    `╚══════════════════════════╝\n\n` +
    `<b>A new hunter has been detected.</b>\n\n` +
    `Hunter: <b>${user.first_name}</b>\n` +
    `Rank: <b>E</b> (Provisional)\n` +
    `Status: <b>AWAKENED</b>\n\n` +
    `The System has granted you access to the Gate network.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎁 <b>Starting Package:</b>\n` +
    `💰 500 Gold\n` +
    `🔑 3 Dungeon Keys\n` +
    `❤️ 100 HP  |  💙 50 MP\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<i>"I alone level up."</i>\n\n` +
    `Use /help to see all commands.\n` +
    `Use /hunt to begin your first battle.`;

  await ctx.replyWithPhoto(
    {
      url: "https://upload.wikimedia.org/wikipedia/en/2/2e/Solo_leveling_manhwa_cover.jpg",
    },
    {
      caption: welcomeMsg,
      parse_mode: "HTML",
    },
  ).catch(() =>
    ctx.replyWithHTML(welcomeMsg),
  );
}
