import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable, shadowArmyTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { pickMonster } from "../data/monsters";
import { SHOP_ITEMS } from "../data/items";
import { PREMIUM_CHARACTERS } from "../data/premium";
import { getXpForLevel, getRankForLevel, getRankUpMessage, getBaseStatsForLevel } from "../utils/ranks";
import { getAuraById } from "../data/auras";
import { getWeaponByName } from "../data/weapons";
import {
  combatSessions,
  processRound,
  buildMoveButtons,
  cleanupExpiredSessions,
  type CombatMove,
  type CombatSession,
} from "../utils/combatEngine";

const HUNT_GIFS = [
  "https://media.tenor.com/XBxJAbgp80IAAAAC/solo-leveling.gif",
  "https://media.tenor.com/OPcQf1QI5TIAAAAC/anime-fight.gif",
  "https://media.tenor.com/rQ0t_g8yMBkAAAAC/sung-jin-woo-solo-leveling.gif",
];
const VICTORY_GIFS = [
  "https://media.tenor.com/VGWZ-7GFpFcAAAAC/solo-leveling-sung-jin-woo.gif",
  "https://media.tenor.com/Hf4KmcBBsLIAAAAC/solo-leveling.gif",
];
function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

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

  // Clean old sessions
  cleanupExpiredSessions();

  // Check if already in combat
  if (combatSessions.has(String(user.id))) {
    const existing = combatSessions.get(String(user.id))!;
    await ctx.replyWithHTML(
      `⚔️ <b>Already in combat with ${existing.monster.emoji} ${existing.monster.name}!</b>\n` +
      `Use the battle buttons to continue or the fight will expire in 10 minutes.`,
    );
    return;
  }

  const monster = pickMonster(hunter.rank);
  const aura = getAuraById(hunter.currentAura);
  const weapon = hunter.equippedWeapon ? getWeaponByName(hunter.equippedWeapon) : null;

  // Shadow army
  const shadows = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.hunterId, hunter.id));
  const shadowBonusAtk = shadows.length > 0
    ? Math.min(Math.floor(shadows.reduce((s, sh) => s + sh.attack, 0) * 0.15), hunter.strength * 2)
    : 0;

  // Premium character bonuses
  const premChar = hunter.premiumCharacter ? PREMIUM_CHARACTERS.find((c) => c.id === hunter.premiumCharacter) : null;

  // Mana coin reward for high rank
  const rankIdx = ["E", "D", "C", "B", "A", "S"].indexOf(monster.rank);
  const manaCoinGain = rankIdx >= 3 ? (rankIdx + 1) * 5 + Math.floor(Math.random() * 10) : 0;

  // Base ATK: STR × 2.5 + level × 1.5 + weapon + shadow bonus
  const weaponAtk = weapon?.atkBonus || 0;
  const baseHunterAtk = Math.max(5, hunter.strength * 2.5 + hunter.level * 1.5 + weaponAtk + shadowBonusAtk);
  const baseMonsterAtk = Math.max(3, monster.strength * 1.8 - hunter.agility * 0.5);

  // XP/gold (with multipliers)
  let xpReward = monster.xpReward;
  let goldReward = monster.goldReward;
  if (premChar) { xpReward = Math.floor(xpReward * premChar.xpMultiplier); goldReward = Math.floor(goldReward * premChar.goldMultiplier); }
  if (aura?.xpBonus) { xpReward = Math.floor(xpReward * (1 + aura.xpBonus / 100)); }

  // Create session
  const session: CombatSession = {
    telegramId: String(user.id),
    hunterId: hunter.id,
    monster,
    hunterHp: hunter.hp,
    hunterMp: hunter.mp,
    hunterMaxHp: hunter.maxHp,
    hunterMaxMp: hunter.maxMp,
    monsterHp: monster.hp,
    monsterMaxHp: monster.hp,
    baseHunterAtk,
    baseMonsterAtk,
    weapon: weapon || null,
    aura: aura || null,
    shadowCount: shadows.length,
    shadowBonusAtk,
    xpReward,
    goldReward,
    manaCoinGain,
    round: 0,
    burnDmgPerRound: 0,
    frozenRoundsLeft: 0,
    log: [],
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  combatSessions.set(String(user.id), session);

  const weaponLine = weapon ? `\n${weapon.emoji} Weapon: <b>${weapon.name}</b> (+${weapon.atkBonus} ATK${weapon.special ? ` | ${weapon.special}` : ""})` : "";
  const auraLine = aura && aura.id !== "none" && aura.id !== "hunter" ? `\n${aura.emoji} Aura: <b>${aura.name}</b>` : "";
  const shadowLine = shadows.length > 0 ? `\n🌑 Shadows: <b>${shadows.length}</b> (+${shadowBonusAtk} ATK)` : "";

  const encounterMsg =
    `🌑 <b>GATE DETECTED!</b>\n\n` +
    `${monster.emoji} <b>${monster.name}</b>\n` +
    `Rank: <b>${monster.rank}</b>  |  HP: <b>${monster.hp}</b>\n` +
    `<i>${monster.description}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━` +
    weaponLine + auraLine + shadowLine +
    `\n\n⚔️ <b>Choose your move:</b>`;

  const buttons = buildMoveButtons(session);

  try {
    await ctx.replyWithAnimation(
      { url: randomFrom(HUNT_GIFS) },
      { caption: encounterMsg, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } },
    );
  } catch {
    await ctx.replyWithHTML(encounterMsg, { reply_markup: { inline_keyboard: buttons } });
  }
}

export async function handleCombatAction(ctx: Context, move: CombatMove): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;

  const session = combatSessions.get(String(user.id));
  if (!session) {
    await ctx.replyWithHTML(`⚠️ No active battle found. Use /hunt to start a fight.`);
    return;
  }

  if (Date.now() > session.expiresAt) {
    combatSessions.delete(String(user.id));
    await ctx.replyWithHTML(`⌛ Your battle expired. The monster fled.\n\nUse /hunt to start a new fight.`);
    return;
  }

  // Noop for disabled buttons
  if ((move as string) === "noop") {
    if (session.hunterMp < 25) await ctx.answerCbQuery("💙 Not enough MP!", { show_alert: true });
    return;
  }

  const result = processRound(session, move);

  const roundHeader = `⚔️ <b>ROUND ${session.round}</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const roundLog = result.roundLog.join("\n");

  if (result.ended) {
    combatSessions.delete(String(user.id));

    if (result.won) {
      await handleVictory(ctx, session);
    } else {
      await ctx.replyWithHTML(
        roundHeader + roundLog + `\n\n💀 <b>DEFEATED!</b>\n${session.monster.emoji} ${session.monster.name} overpowers you.\n<i>You barely escape...</i>`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "😴 Rest", callback_data: "action_rest" },
              { text: "🧪 Inventory", callback_data: "action_inventory" },
            ]],
          },
        },
      );

      // Update DB on defeat
      const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.id, session.hunterId));
      if (hunter) {
        await db.update(huntersTable).set({
          hp: Math.max(1, Math.floor(session.hunterHp)),
          mp: session.hunterMp,
          losses: hunter.losses + 1,
          lastHunt: new Date(), lastSeen: new Date(),
        }).where(eq(huntersTable.id, hunter.id));
      }
    }
    return;
  }

  // Battle continues — show round result + new move buttons
  const buttons = buildMoveButtons(session);
  await ctx.replyWithHTML(
    roundHeader + roundLog + `\n\n⚔️ <b>Choose your next move:</b>`,
    { reply_markup: { inline_keyboard: buttons } },
  );
}

async function handleVictory(ctx: Context, session: CombatSession): Promise<void> {
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.id, session.hunterId));
  if (!hunter) return;

  let newHp = Math.max(1, session.hunterHp);
  let newMp = session.hunterMp;
  let newXp = hunter.xp + session.xpReward;
  let newGold = hunter.gold + session.goldReward;
  let newManaCoin = hunter.manaCoin + session.manaCoinGain;
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
  let rankUpMsg = "";
  let levelUpMsg = "";
  let dropMsg = "";

  // Level up loop
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
    levelUpMsg = `\n\n⭐ <b>LEVEL UP!</b> Level <b>${newLevel}</b>! +5 Stat Points`;
  }

  // Item drop check
  if (Math.random() < session.monster.dropChance && session.monster.possibleDrops.length > 0) {
    const dropName = session.monster.possibleDrops[Math.floor(Math.random() * session.monster.possibleDrops.length)];
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
        dropMsg = `\n🎁 <b>DROP:</b> ${shopItem.emoji} ${dropName}`;
      }
    }
  }

  // Save to DB
  await db.update(huntersTable).set({
    hp: newHp, mp: newMp, maxHp: newMaxHp, maxMp: newMaxMp,
    xp: newXp, xpToNextLevel: xpToNext, level: newLevel, rank: newRank,
    gold: newGold, manaCoin: newManaCoin,
    strength: newStr, agility: newAgi, intelligence: newInt, perception: newPer,
    statPoints: newStatPoints,
    wins: hunter.wins + 1, monstersKilled: hunter.monstersKilled + 1,
    lastHunt: new Date(), lastSeen: new Date(),
    lastKilledMonster: session.monster.name,
    lastKilledMonsterRank: session.monster.rank,
    lastKilledMonsterEmoji: session.monster.emoji,
  }).where(eq(huntersTable.id, hunter.id));

  const mcLine = session.manaCoinGain > 0 ? `\n💎 MC: <b>+${session.manaCoinGain}</b>` : "";
  const shadowLine = session.shadowBonusAtk > 0 ? `\n🌑 Shadow Bonus: <b>+${session.shadowBonusAtk} ATK</b>` : "";
  const weaponLine = session.weapon ? `\n${session.weapon.emoji} <b>${session.weapon.name}</b> helped!` : "";

  const victoryMsg =
    `✅ <b>VICTORY!</b> ${session.monster.emoji} ${session.monster.name} defeated!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Rounds fought: <b>${session.round}</b>\n\n` +
    `━━ REWARDS ━━\n` +
    `✨ XP: <b>+${session.xpReward}</b>  💰 Gold: <b>+${session.goldReward}</b>` +
    mcLine + shadowLine + weaponLine + dropMsg +
    `\n\n❤️ HP: <b>${newHp}/${newMaxHp}</b>  💙 MP: <b>${newMp}/${newMaxMp}</b>\n` +
    `📊 XP: <b>${newXp}/${xpToNext}</b>` +
    levelUpMsg;

  try {
    await ctx.replyWithAnimation(
      { url: randomFrom(VICTORY_GIFS) },
      {
        caption: victoryMsg,
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
    await ctx.replyWithHTML(victoryMsg, {
      reply_markup: {
        inline_keyboard: [[
          { text: "⚔️ Hunt Again", callback_data: "action_hunt" },
          { text: "🌑 Extract Shadow", callback_data: "action_extract" },
        ]],
      },
    });
  }

  if (rankUpMsg) await ctx.replyWithHTML(rankUpMsg);
}
