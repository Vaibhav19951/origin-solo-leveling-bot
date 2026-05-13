import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { pickMonster } from "../data/monsters";
import { SHOP_ITEMS } from "../data/items";
import { simulateCombat } from "../utils/combat";
import { formatCooldown } from "../utils/format";
import { getXpForLevel, getRankForLevel, getRankUpMessage, getBaseStatsForLevel } from "../utils/ranks";

const HUNT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function handleHunt(ctx: Context): Promise<void> {
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

  // Check if dead
  if (hunter.hp <= 0) {
    await ctx.replyWithHTML(
      `💀 <b>[ SYSTEM ]</b>\nYou are critically injured.\nUse /rest or a potion to recover first.`,
    );
    return;
  }

  // Check cooldown
  if (hunter.lastHunt) {
    const elapsed = Date.now() - hunter.lastHunt.getTime();
    if (elapsed < HUNT_COOLDOWN_MS) {
      const remaining = HUNT_COOLDOWN_MS - elapsed;
      await ctx.replyWithHTML(
        `⏳ <b>[ SYSTEM ]</b>\nHunt cooldown active.\nNext hunt available in: <b>${formatCooldown(remaining)}</b>`,
      );
      return;
    }
  }

  const monster = pickMonster(hunter.rank);

  await ctx.replyWithHTML(
    `🌑 <b>DUNGEON GATE DETECTED</b> 🌑\n\n` +
    `${monster.emoji} <b>${monster.name}</b> appears!\n` +
    `Rank: <b>${monster.rank}</b>  |  HP: <b>${monster.hp}</b>\n` +
    `<i>${monster.description}</i>\n\n` +
    `⚔️ <i>Battle commencing...</i>`,
  );

  // Simulate combat
  const result = simulateCombat(hunter, monster);

  let newHp = Math.max(0, hunter.hp - result.damageTaken);
  let newXp = hunter.xp;
  let newGold = hunter.gold;
  let newLevel = hunter.level;
  let newRank = hunter.rank;
  let newMaxHp = hunter.maxHp;
  let newMaxMp = hunter.maxMp;
  let newStr = hunter.strength;
  let newAgi = hunter.agility;
  let newInt = hunter.intelligence;
  let newPer = hunter.perception;
  let xpToNext = hunter.xpToNextLevel;
  let newStatPoints = hunter.statPoints;
  let newWins = hunter.wins;
  let newLosses = hunter.losses;
  let newKills = hunter.monstersKilled;

  let rankUpMsg = "";
  let levelUpMsg = "";
  let dropMsg = "";

  if (result.won) {
    newXp += monster.xpReward;
    newGold += monster.goldReward;
    newWins++;
    newKills++;

    // Level up loop
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
      newHp = Math.min(newHp + 50, newMaxHp); // partial heal on level up
    }

    // Check rank promotion
    const promotedRank = getRankForLevel(newLevel);
    if (promotedRank !== hunter.rank) {
      newRank = promotedRank;
      rankUpMsg = "\n\n" + getRankUpMessage(newRank);
    }

    if (newLevel > hunter.level) {
      levelUpMsg = `\n\n⭐ <b>LEVEL UP!</b> You are now Level <b>${newLevel}</b>!\n+5 Stat Points available via /allocate`;
    }

    // Item drop
    if (Math.random() < monster.dropChance && monster.possibleDrops.length > 0) {
      const dropName = monster.possibleDrops[Math.floor(Math.random() * monster.possibleDrops.length)];
      const shopItem = SHOP_ITEMS.find((i) => i.name === dropName);
      if (shopItem) {
        // Find or insert item in db
        const [dbItem] = await db
          .select()
          .from(itemsTable)
          .where(eq(itemsTable.name, dropName));

        if (dbItem) {
          const [existing] = await db
            .select()
            .from(inventoryTable)
            .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));

          if (existing) {
            await db
              .update(inventoryTable)
              .set({ quantity: existing.quantity + 1 })
              .where(eq(inventoryTable.id, existing.id));
          } else {
            await db.insert(inventoryTable).values({
              hunterId: hunter.id,
              itemId: dbItem.id,
              quantity: 1,
            });
          }
          dropMsg = `\n\n🎁 <b>ITEM DROP:</b> ${shopItem.emoji} ${dropName}`;
        }
      }
    }

    const combatLog = result.log.slice(0, 3).join("\n");

    const victoryMsg =
      `✅ <b>VICTORY!</b>\n\n` +
      `${combatLog}\n\n` +
      `━━━━━ REWARDS ━━━━━\n` +
      `✨ XP: <b>+${monster.xpReward}</b>  |  💰 Gold: <b>+${monster.goldReward}</b>\n` +
      `❤️ HP: <b>${newHp}/${newMaxHp}</b>\n` +
      `📊 XP Progress: <b>${newXp}/${xpToNext}</b>` +
      levelUpMsg +
      rankUpMsg +
      dropMsg;

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
        wins: newWins,
        monstersKilled: newKills,
        lastHunt: new Date(),
      })
      .where(eq(huntersTable.id, hunter.id));

    await ctx.replyWithHTML(victoryMsg);

    if (rankUpMsg) {
      await ctx.replyWithHTML(rankUpMsg);
    }
  } else {
    newLosses++;
    newHp = Math.max(0, Math.floor(hunter.hp * 0.4)); // lose 60% HP on loss

    const combatLog = result.log.slice(0, 3).join("\n");

    const defeatMsg =
      `💀 <b>DEFEATED</b>\n\n` +
      `${combatLog}\n\n` +
      `━━━━━ RESULT ━━━━━\n` +
      `❤️ HP remaining: <b>${newHp}/${hunter.maxHp}</b>\n\n` +
      `<i>You managed to escape before the fatal blow...</i>\n` +
      `Use /rest to recover HP.`;

    await db
      .update(huntersTable)
      .set({
        hp: newHp,
        losses: newLosses,
        lastHunt: new Date(),
      })
      .where(eq(huntersTable.id, hunter.id));

    await ctx.replyWithHTML(defeatMsg);
  }
}
