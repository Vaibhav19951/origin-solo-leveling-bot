import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable, shadowArmyTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { pickMonster } from "../data/monsters";
import { SHOP_ITEMS } from "../data/items";
import { PREMIUM_CHARACTERS } from "../data/premium";
import { simulateCombat } from "../utils/combat";
import { getXpForLevel, getRankForLevel, getRankUpMessage, getBaseStatsForLevel } from "../utils/ranks";

const HUNT_GIFS = [
  "https://media.tenor.com/XBxJAbgp80IAAAAC/solo-leveling.gif",
  "https://media.tenor.com/OPcQf1QI5TIAAAAC/anime-fight.gif",
  "https://media.tenor.com/rQ0t_g8yMBkAAAAC/sung-jin-woo-solo-leveling.gif",
];

const VICTORY_GIFS = [
  "https://media.tenor.com/VGWZ-7GFpFcAAAAC/solo-leveling-sung-jin-woo.gif",
  "https://media.tenor.com/Hf4KmcBBsLIAAAAC/solo-leveling.gif",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function handleHunt(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ <b>[ SYSTEM ]</b>\nRegister first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (hunter.hp <= 0) {
    await ctx.replyWithHTML(`💀 <b>[ SYSTEM ]</b>\nYou are critically injured.\nUse /rest or a potion to recover first.`);
    return;
  }

  const monster = pickMonster(hunter.rank);

  // Shadow Army bonus
  const shadows = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.hunterId, hunter.id));
  const shadowBonusAtk = shadows.length > 0
    ? Math.min(Math.floor(shadows.reduce((s, sh) => s + sh.attack, 0) * 0.15), hunter.strength * 2)
    : 0;
  const shadowLine = shadows.length > 0
    ? `\n🌑 Shadow Army: <b>${shadows.length} soldiers</b> (+${shadowBonusAtk} ATK bonus)`
    : "";

  const premChar = hunter.premiumCharacter
    ? PREMIUM_CHARACTERS.find((c) => c.id === hunter.premiumCharacter)
    : null;

  const encounterMsg =
    `🌑 <b>DUNGEON GATE DETECTED</b> 🌑\n\n` +
    `${monster.emoji} <b>${monster.name}</b> appears!\n` +
    `Rank: <b>${monster.rank}</b>  |  HP: <b>${monster.hp}</b>\n` +
    `<i>${monster.description}</i>` +
    shadowLine +
    `\n\n⚔️ <i>Battle commencing...</i>`;

  try {
    await ctx.replyWithAnimation({ url: randomFrom(HUNT_GIFS) }, { caption: encounterMsg, parse_mode: "HTML" });
  } catch {
    await ctx.replyWithHTML(encounterMsg);
  }

  // Boost hunter strength by shadow bonus for combat calc
  const boostedHunter = shadowBonusAtk > 0
    ? { ...hunter, strength: hunter.strength + shadowBonusAtk }
    : hunter;

  const result = simulateCombat(boostedHunter, monster);

  let newHp = Math.max(0, hunter.hp - result.damageTaken);
  let xpGained = monster.xpReward;
  let goldGained = monster.goldReward;
  let manaCoinGained = 0;
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
    if (premChar) {
      xpGained = Math.floor(xpGained * premChar.xpMultiplier);
      goldGained = Math.floor(goldGained * premChar.goldMultiplier);
    }

    const rankIdx = ["E", "D", "C", "B", "A", "S"].indexOf(monster.rank);
    if (rankIdx >= 3) {
      manaCoinGained = (rankIdx + 1) * 5 + Math.floor(Math.random() * 10);
    }

    newXp += xpGained;
    newGold += goldGained;
    newWins++;
    newKills++;

    while (newXp >= xpToNext && newLevel < 100) {
      newXp -= xpToNext;
      newLevel++;
      newStatPoints += 5;
      xpToNext = getXpForLevel(newLevel);
      const stats = getBaseStatsForLevel(newLevel);
      newMaxHp = stats.maxHp; newMaxMp = stats.maxMp;
      newStr = stats.strength; newAgi = stats.agility;
      newInt = stats.intelligence; newPer = stats.perception;
      newHp = Math.min(newHp + 50, newMaxHp);
    }

    const promotedRank = getRankForLevel(newLevel);
    if (promotedRank !== hunter.rank) {
      newRank = promotedRank;
      rankUpMsg = "\n\n" + getRankUpMessage(newRank);
    }
    if (newLevel > hunter.level) {
      levelUpMsg = `\n\n⭐ <b>LEVEL UP!</b> You are now Level <b>${newLevel}</b>!\n+5 Stat Points — use /allocate`;
    }

    if (Math.random() < monster.dropChance && monster.possibleDrops.length > 0) {
      const dropName = monster.possibleDrops[Math.floor(Math.random() * monster.possibleDrops.length)];
      const shopItem = SHOP_ITEMS.find((i) => i.name === dropName);
      if (shopItem) {
        const [dbItem] = await db.select().from(itemsTable).where(eq(itemsTable.name, dropName));
        if (dbItem) {
          const [existing] = await db.select().from(inventoryTable)
            .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));
          if (existing) {
            await db.update(inventoryTable).set({ quantity: existing.quantity + 1 }).where(eq(inventoryTable.id, existing.id));
          } else {
            await db.insert(inventoryTable).values({ hunterId: hunter.id, itemId: dbItem.id, quantity: 1 });
          }
          dropMsg = `\n\n🎁 <b>ITEM DROP:</b> ${shopItem.emoji} ${dropName}`;
        }
      }
    }

    const combatLog = result.log.slice(0, 3).join("\n");
    const mcLine = manaCoinGained > 0 ? `\n💎 Mana Coins: <b>+${manaCoinGained}</b>` : "";
    const premLine = premChar ? `\n✨ ${premChar.emoji} ${premChar.name} bonus active!` : "";
    const shadowBoostLine = shadowBonusAtk > 0 ? `\n🌑 Shadow Army boosted your ATK by <b>+${shadowBonusAtk}</b>!` : "";

    const victoryMsg =
      `✅ <b>VICTORY!</b>\n\n${combatLog}\n\n` +
      `━━━━━ REWARDS ━━━━━\n` +
      `✨ XP: <b>+${xpGained}</b>  |  💰 Gold: <b>+${goldGained}</b>` +
      mcLine +
      `\n❤️ HP: <b>${newHp}/${newMaxHp}</b>\n` +
      `📊 XP: <b>${newXp}/${xpToNext}</b>` +
      premLine + shadowBoostLine + levelUpMsg + dropMsg;

    await db.update(huntersTable).set({
      hp: newHp, maxHp: newMaxHp, maxMp: newMaxMp,
      xp: newXp, xpToNextLevel: xpToNext, level: newLevel, rank: newRank,
      gold: newGold, manaCoin: hunter.manaCoin + manaCoinGained,
      strength: newStr, agility: newAgi, intelligence: newInt, perception: newPer,
      statPoints: newStatPoints, wins: newWins, monstersKilled: newKills,
      lastHunt: new Date(), lastSeen: new Date(),
      // Track last killed monster for shadow extraction
      lastKilledMonster: monster.name,
      lastKilledMonsterRank: monster.rank,
      lastKilledMonsterEmoji: monster.emoji,
    }).where(eq(huntersTable.id, hunter.id));

    const extractHint = `\n\n🌑 <i>Tip: Use /extract to raise this monster as a shadow soldier!</i>`;

    try {
      await ctx.replyWithAnimation(
        { url: randomFrom(VICTORY_GIFS) },
        {
          caption: victoryMsg + extractHint,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "⚔️ Hunt Again", callback_data: "action_hunt" },
              { text: "🌑 Extract Shadow", callback_data: "action_extract" },
            ], [
              { text: "📊 Profile", callback_data: "action_profile" },
              { text: "🌑 Shadow Army", callback_data: "action_shadows" },
            ]],
          },
        },
      );
    } catch {
      await ctx.replyWithHTML(victoryMsg + extractHint, {
        reply_markup: {
          inline_keyboard: [[
            { text: "⚔️ Hunt Again", callback_data: "action_hunt" },
            { text: "🌑 Extract Shadow", callback_data: "action_extract" },
          ]],
        },
      });
    }

    if (rankUpMsg) await ctx.replyWithHTML(rankUpMsg);
  } else {
    newLosses++;
    newHp = Math.max(0, Math.floor(hunter.hp * 0.4));
    const combatLog = result.log.slice(0, 3).join("\n");

    const defeatMsg =
      `💀 <b>DEFEATED</b>\n\n${combatLog}\n\n` +
      `━━━━━ RESULT ━━━━━\n` +
      `❤️ HP remaining: <b>${newHp}/${hunter.maxHp}</b>\n\n` +
      `<i>You escaped before the fatal blow...</i>`;

    await db.update(huntersTable).set({
      hp: newHp, losses: newLosses, lastHunt: new Date(), lastSeen: new Date(),
    }).where(eq(huntersTable.id, hunter.id));

    await ctx.replyWithHTML(defeatMsg, {
      reply_markup: {
        inline_keyboard: [[
          { text: "😴 Rest", callback_data: "action_rest" },
          { text: "🧪 Use Potion", callback_data: "action_inventory" },
        ]],
      },
    });
  }
}
