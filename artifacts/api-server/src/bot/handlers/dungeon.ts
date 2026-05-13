import type { Context } from "telegraf";
import { db, huntersTable, guildsTable, guildMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DUNGEONS } from "../data/dungeons";
import { simulateDungeon } from "../utils/combat";
import { getXpForLevel, getRankForLevel, getRankUpMessage, getBaseStatsForLevel } from "../utils/ranks";
import { PREMIUM_CHARACTERS } from "../data/premium";

const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

function getEffectiveRank(rank: string): string {
  if (rank === "NLH" || rank === "Monarch") return "S";
  return rank;
}

function getDungeonForRank(rank: string) {
  const effective = getEffectiveRank(rank);
  // Strict: hunter can only do their exact rank dungeon (or the highest available if no exact match)
  return DUNGEONS.find((d) => d.rank === effective) || DUNGEONS.find((d) => d.rank === "E")!;
}

function getAllowedDungeons(rank: string) {
  const effectiveRank = getEffectiveRank(rank);
  const rankIdx = RANK_ORDER.indexOf(effectiveRank);
  return DUNGEONS.filter((d) => {
    const dIdx = RANK_ORDER.indexOf(d.rank);
    return dIdx <= rankIdx;
  });
}

export async function handleDungeon(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ <b>[ SYSTEM ]</b>\nRegister first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (hunter.hp <= 0) {
    await ctx.replyWithHTML(`💀 <b>[ SYSTEM ]</b>\nYou cannot enter a dungeon while critically injured.\nUse /rest to recover.`);
    return;
  }

  if (hunter.dungeonKeys <= 0) {
    await ctx.replyWithHTML(`🔑 <b>[ SYSTEM ]</b>\nNo dungeon keys remaining.\n• /daily — 1 key per day\n• /shop — buy for 300 gold`);
    return;
  }

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ");
  let dungeon = getDungeonForRank(hunter.rank);

  if (parts.length > 1) {
    const query = parts.slice(1).join(" ").toLowerCase();
    const found = DUNGEONS.find((d) =>
      d.name.toLowerCase().includes(query) || d.rank.toLowerCase() === query
    );
    if (found) {
      // RANK LOCK: check if this dungeon is accessible
      const allowed = getAllowedDungeons(hunter.rank);
      if (!allowed.find((d) => d.name === found.name)) {
        await ctx.replyWithHTML(
          `🔒 <b>RANK LOCKED</b>\n\n` +
          `<b>${found.name}</b> requires Rank <b>${found.rank}</b>.\n` +
          `Your rank: <b>${hunter.rank}</b>\n\n` +
          `You can only enter dungeons at or below your current rank.\nRank up to unlock higher dungeons!`,
        );
        return;
      }
      dungeon = found;
    } else {
      const allowed = getAllowedDungeons(hunter.rank);
      const list = allowed.map((d) => `${d.emoji} <b>${d.name}</b> (Rank ${d.rank})`).join("\n");
      await ctx.replyWithHTML(`⚠️ Dungeon not found.\n\nYour available dungeons:\n${list}\n\nUsage: /dungeon [rank or name]`);
      return;
    }
  }

  const premChar = hunter.premiumCharacter
    ? PREMIUM_CHARACTERS.find((c) => c.id === hunter.premiumCharacter)
    : null;

  await ctx.replyWithHTML(
    `🔑 <b>DUNGEON GATE OPENED</b>\n\n` +
    `${dungeon.emoji} <b>${dungeon.name}</b>\n` +
    `Rank: <b>${dungeon.rank}</b>  |  Boss: <b>${dungeon.bossName}</b>\n` +
    `Waves: <b>${dungeon.waves}</b>\n\n` +
    `<i>${dungeon.imageCaption}</i>\n\n` +
    `⚠️ 1 Dungeon Key consumed.\nEntering now...`,
  );

  // Consume key immediately
  await db.update(huntersTable).set({ dungeonKeys: hunter.dungeonKeys - 1 }).where(eq(huntersTable.id, hunter.id));

  const result = simulateDungeon(hunter, dungeon);

  let newHp = Math.max(0, hunter.hp - result.damageTaken);
  let newXp = hunter.xp;
  let newGold = hunter.gold;
  let newManaCoin = hunter.manaCoin;
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
    let xpGain = dungeon.xpReward;
    let goldGain = dungeon.goldReward;

    if (premChar) {
      xpGain = Math.floor(xpGain * premChar.xpMultiplier);
      goldGain = Math.floor(goldGain * premChar.goldMultiplier);
    }

    // Mana coins for S-rank dungeons
    const rankIdx = RANK_ORDER.indexOf(dungeon.rank);
    if (rankIdx >= 4) {
      newManaCoin += Math.floor(rankIdx * 20 + Math.random() * 50);
    }

    newXp += xpGain;
    newGold += goldGain;
    newDungeonsCleared++;
    newWins++;

    while (newXp >= xpToNext && newLevel < 100) {
      newXp -= xpToNext;
      newLevel++;
      newStatPoints += 5;
      xpToNext = getXpForLevel(newLevel);
      const stats = getBaseStatsForLevel(newLevel);
      newMaxHp = stats.maxHp; newMaxMp = stats.maxMp;
      newStr = stats.strength; newAgi = stats.agility;
      newInt = stats.intelligence; newPer = stats.perception;
      newHp = Math.min(newHp + 80, newMaxHp);
    }

    const promotedRank = getRankForLevel(newLevel);
    if (promotedRank !== hunter.rank) {
      newRank = promotedRank;
      rankUpMsg = "\n\n" + getRankUpMessage(newRank);
    }
    if (newLevel > hunter.level) {
      levelUpMsg = `\n\n⭐ <b>LEVEL UP!</b> Level <b>${newLevel}</b>! +5 Stat Points`;
    }

    await db.update(huntersTable).set({
      hp: newHp, maxHp: newMaxHp, maxMp: newMaxMp,
      xp: newXp, xpToNextLevel: xpToNext, level: newLevel, rank: newRank,
      gold: newGold, manaCoin: newManaCoin,
      strength: newStr, agility: newAgi, intelligence: newInt, perception: newPer,
      statPoints: newStatPoints, dungeonsCleared: newDungeonsCleared, wins: newWins,
      dungeonKeys: hunter.dungeonKeys - 1, lastSeen: new Date(),
    }).where(eq(huntersTable.id, hunter.id));

    // Update guild stats
    const [gm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.hunterId, hunter.id));
    if (gm) {
      await db.update(guildsTable).set({ dungeonsCleared: result.won ? 1 : 0 }).where(eq(guildsTable.id, gm.guildId));
    }

    const logText = result.log.join("\n");
    const mcLine = newManaCoin > hunter.manaCoin ? `\n💎 Mana Coins: <b>+${newManaCoin - hunter.manaCoin}</b>` : "";

    await ctx.replyWithHTML(
      `🏆 <b>DUNGEON CLEARED!</b>\n\n${logText}\n\n` +
      `━━━━━ REWARDS ━━━━━\n` +
      `✨ XP: <b>+${xpGain}</b>\n` +
      `💰 Gold: <b>+${goldGain}</b>` +
      mcLine +
      `\n❤️ HP: <b>${newHp}/${newMaxHp}</b>` +
      levelUpMsg + rankUpMsg,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "⚔️ Hunt", callback_data: "action_hunt" },
            { text: "🔑 Dungeon Again", callback_data: "action_dungeon" },
          ]],
        },
      },
    );
    if (rankUpMsg) await ctx.replyWithHTML(rankUpMsg);
  } else {
    newLosses++;
    await db.update(huntersTable).set({
      hp: 1, losses: newLosses,
      dungeonKeys: hunter.dungeonKeys - 1, lastSeen: new Date(),
    }).where(eq(huntersTable.id, hunter.id));

    const logText = result.log.join("\n");
    await ctx.replyWithHTML(
      `💀 <b>DUNGEON FAILED</b>\n\n${logText}\n\n` +
      `You barely escaped with your life.\n❤️ HP: <b>1/${hunter.maxHp}</b>`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "😴 Rest", callback_data: "action_rest" },
            { text: "🧪 Use Potion", callback_data: "action_inventory" },
          ]],
        },
      },
    );
  }
}

export async function handleDungeonList(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  const allowed = getAllowedDungeons(hunter.rank);
  const locked = DUNGEONS.filter((d) => !allowed.find((a) => a.name === d.name));

  const allowedList = allowed.map((d) =>
    `${d.emoji} <b>${d.name}</b> (Rank ${d.rank})\n   Boss: ${d.bossName} | XP:${d.xpReward} | Gold:${d.goldReward}`
  ).join("\n\n");

  const lockedList = locked.map((d) => `🔒 <i>${d.name}</i> (Rank ${d.rank} required)`).join("\n");

  await ctx.replyWithHTML(
    `🏰 <b>DUNGEON REGISTRY</b>\n` +
    `🔑 Keys: <b>${hunter.dungeonKeys}</b>  |  Rank: <b>${hunter.rank}</b>\n\n` +
    `✅ <b>Available Dungeons:</b>\n${allowedList}` +
    (lockedList ? `\n\n🔒 <b>Locked (rank up to unlock):</b>\n${lockedList}` : "") +
    `\n\nUse: /dungeon [rank or name]`,
  );
}
