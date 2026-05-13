import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getDungeonsForRank, getDefaultDungeon, DUNGEONS } from "../data/dungeons";
import { simulateDungeon } from "../utils/combat";
import { getXpForLevel, getRankForLevel, getRankUpMessage, getBaseStatsForLevel } from "../utils/ranks";

export async function handleDungeon(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ <b>[ SYSTEM ]</b>\nRegister first with /start`);
    return;
  }

  if (hunter.hp <= 0) {
    await ctx.replyWithHTML(`💀 <b>[ SYSTEM ]</b>\nYou cannot enter a dungeon while critically injured.\nUse /rest to recover.`);
    return;
  }

  if (hunter.dungeonKeys <= 0) {
    await ctx.replyWithHTML(
      `🔑 <b>[ SYSTEM ]</b>\nNo dungeon keys remaining.\n\nKeys are earned from:\n• /daily — 1 key per day\n• /shop — purchase for 300 gold`,
    );
    return;
  }

  const available = getDungeonsForRank(hunter.rank);
  if (available.length === 0) {
    await ctx.replyWithHTML(`⚠️ <b>[ SYSTEM ]</b>\nNo dungeons available for your rank.`);
    return;
  }

  // Check if user specified a dungeon
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ");
  let dungeon = getDefaultDungeon(hunter.rank);

  if (parts.length > 1) {
    const query = parts.slice(1).join(" ").toLowerCase();
    const found = DUNGEONS.find(
      (d) => d.name.toLowerCase().includes(query) || d.rank.toLowerCase() === query,
    );
    if (found && getDungeonsForRank(hunter.rank).includes(found)) {
      dungeon = found;
    } else {
      const list = available.map((d) => `${d.emoji} <b>${d.name}</b> (Rank ${d.rank})`).join("\n");
      await ctx.replyWithHTML(
        `⚠️ Dungeon not found or above your rank.\n\nAvailable dungeons:\n${list}\n\nUsage: /dungeon [name or rank]`,
      );
      return;
    }
  }

  await ctx.replyWithHTML(
    `🔑 <b>DUNGEON GATE OPENED</b>\n\n` +
    `${dungeon.emoji} <b>${dungeon.name}</b>\n` +
    `Rank: <b>${dungeon.rank}</b>  |  Boss: <b>${dungeon.bossName}</b>\n\n` +
    `<i>${dungeon.imageCaption}</i>\n\n` +
    `⚠️ 1 Dungeon Key consumed.\n` +
    `Entering dungeon... prepare for combat!`,
  );

  // Consume key
  await db
    .update(huntersTable)
    .set({ dungeonKeys: hunter.dungeonKeys - 1 })
    .where(eq(huntersTable.id, hunter.id));

  const result = simulateDungeon(hunter, dungeon);

  const logText = result.log.join("\n");
  let newHp = Math.max(0, hunter.hp - result.damageTaken);
  let newXp = hunter.xp;
  let newGold = hunter.gold;
  let newLevel = hunter.level;
  let newRank = hunter.rank;
  let xpToNext = hunter.xpToNextLevel;
  let newMaxHp = hunter.maxHp;
  let newMaxMp = hunter.maxMp;
  let newStr = hunter.strength;
  let newAgi = hunter.agility;
  let newInt = hunter.intelligence;
  let newPer = hunter.perception;
  let newStatPoints = hunter.statPoints;
  let newDungeonsCleared = hunter.dungeonsCleared;
  let newWins = hunter.wins;
  let newLosses = hunter.losses;
  let rankUpMsg = "";
  let levelUpMsg = "";

  if (result.won) {
    newXp += dungeon.xpReward;
    newGold += dungeon.goldReward;
    newDungeonsCleared++;
    newWins++;

    while (newXp >= xpToNext && newLevel < 100) {
      newXp -= xpToNext;
      newLevel++;
      newStatPoints += 5;
      xpToNext = getXpForLevel(newLevel);
      const stats = getBaseStatsForLevel(newLevel);
      newMaxHp = stats.maxHp;
      newMaxMp = stats.maxMp;
      newStr = stats.strength;
      newAgi = stats.agility;
      newInt = stats.intelligence;
      newPer = stats.perception;
      newHp = Math.min(newHp + 80, newMaxHp);
    }

    const promotedRank = getRankForLevel(newLevel);
    if (promotedRank !== hunter.rank) {
      newRank = promotedRank;
      rankUpMsg = "\n\n" + getRankUpMessage(newRank);
    }

    if (newLevel > hunter.level) {
      levelUpMsg = `\n\n⭐ <b>LEVEL UP!</b> Level <b>${newLevel}</b>!\n+5 Stat Points available via /allocate`;
    }

    await db
      .update(huntersTable)
      .set({
        hp: newHp,
        maxHp: newMaxHp,
        maxMp: newMaxMp,
        xp: newXp,
        xpToNextLevel: xpToNext,
        level: newLevel,
        rank: newRank,
        gold: newGold,
        strength: newStr,
        agility: newAgi,
        intelligence: newInt,
        perception: newPer,
        statPoints: newStatPoints,
        dungeonsCleared: newDungeonsCleared,
        wins: newWins,
        dungeonKeys: hunter.dungeonKeys - 1,
      })
      .where(eq(huntersTable.id, hunter.id));

    await ctx.replyWithHTML(
      `🏆 <b>DUNGEON CLEARED!</b>\n\n` +
      `${logText}\n\n` +
      `━━━━━ REWARDS ━━━━━\n` +
      `✨ XP: <b>+${dungeon.xpReward}</b>\n` +
      `💰 Gold: <b>+${dungeon.goldReward}</b>\n` +
      `❤️ HP: <b>${newHp}/${newMaxHp}</b>` +
      levelUpMsg +
      rankUpMsg,
    );

    if (rankUpMsg) {
      await ctx.replyWithHTML(rankUpMsg);
    }
  } else {
    newLosses++;
    newHp = 1; // barely survive

    await db
      .update(huntersTable)
      .set({
        hp: newHp,
        losses: newLosses,
        dungeonKeys: hunter.dungeonKeys - 1,
      })
      .where(eq(huntersTable.id, hunter.id));

    await ctx.replyWithHTML(
      `💀 <b>DUNGEON FAILED</b>\n\n` +
      `${logText}\n\n` +
      `You barely escaped with your life.\n` +
      `❤️ HP: <b>1/${hunter.maxHp}</b>\n\n` +
      `Use /rest to recover before attempting again.`,
    );
  }
}

export async function handleDungeonList(ctx: Context): Promise<void> {
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

  const available = getDungeonsForRank(hunter.rank);
  const list = available
    .map(
      (d) =>
        `${d.emoji} <b>${d.name}</b> (Rank ${d.rank})\n` +
        `   Boss: ${d.bossName} | XP: ${d.xpReward} | Gold: ${d.goldReward}\n` +
        `   <i>${d.description}</i>`,
    )
    .join("\n\n");

  await ctx.replyWithHTML(
    `🏰 <b>AVAILABLE DUNGEONS</b>\n` +
    `🔑 Keys: <b>${hunter.dungeonKeys}</b>\n\n` +
    `${list}\n\n` +
    `Use: /dungeon [name or rank]`,
  );
}
