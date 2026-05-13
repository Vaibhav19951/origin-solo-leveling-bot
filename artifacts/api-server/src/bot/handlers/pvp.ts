import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { db, huntersTable, pvpLogTable } from "@workspace/db";
import { eq, gte, ne, and } from "drizzle-orm";
import { simulateCombat } from "../utils/combat";
import { RANK_EMOJIS } from "../utils/ranks";
import type { Monster } from "../data/monsters";
import { logger } from "../../lib/logger";

const ONLINE_THRESHOLD_MS = 20 * 60 * 1000;

// Global bot reference for sending messages to other users
let botInstance: Telegraf | null = null;
export function setBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

// Pending challenges: challengerId -> { defenderId, expiry }
const pendingChallenges = new Map<number, { defenderId: number; expiry: number; manaBet: number }>();

export async function handlePvpList(ctx: Context): Promise<void> {
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

  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const onlineHunters = await db
    .select()
    .from(huntersTable)
    .where(and(gte(huntersTable.lastSeen, cutoff), ne(huntersTable.id, hunter.id)));

  if (onlineHunters.length === 0) {
    await ctx.replyWithHTML(
      `👥 <b>No other hunters online right now.</b>\n\nHunters appear online when they use any command within the last 20 minutes.\nTry /hunt to gain XP while waiting for opponents!`,
    );
    return;
  }

  const sameZone = onlineHunters.filter((h) => h.location === hunter.location);
  const otherZones = onlineHunters.filter((h) => h.location !== hunter.location);

  const formatHunter = (h: (typeof onlineHunters)[0]) => {
    const rankE = RANK_EMOJIS[h.rank] || "⬜";
    const name = h.firstName || h.username || `Hunter#${h.id}`;
    return `${rankE} <b>${name}</b> — Lv.${h.level} [${h.rank}] 🏆${h.pvpWins}W/${h.pvpLosses}L`;
  };

  let msg =
    `⚔️ <b>ONLINE HUNTERS</b>\n` +
    `📍 Your location: <b>${hunter.location}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (sameZone.length > 0) {
    msg += `\n🟢 <b>In your zone (same location):</b>\n`;
    msg += sameZone.map((h) => `  ${formatHunter(h)}`).join("\n");
  }
  if (otherZones.length > 0) {
    msg += `\n\n🌍 <b>Other zones:</b>\n`;
    msg += otherZones.slice(0, 8).map((h) => `  ${formatHunter(h)} — 📍${h.location}`).join("\n");
  }

  msg += `\n\nChallenge: /pvp @username [mana bet]\nExample: /pvp @SungJinWoo 100`;

  const challengeButtons = sameZone.slice(0, 4).map((h) => ({
    text: `⚔️ Challenge ${h.firstName || h.username || `Hunter#${h.id}`}`,
    callback_data: `pvp_challenge_${h.id}_50`,
  }));

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < challengeButtons.length; i += 1) {
    rows.push([challengeButtons[i]]);
  }
  rows.push([{ text: "🗺️ View Map", callback_data: "action_map" }]);

  await ctx.replyWithHTML(msg, { reply_markup: { inline_keyboard: rows } });
}

export async function handlePvp(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [challenger] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!challenger) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  if (challenger.hp <= 0) {
    await ctx.replyWithHTML(`💀 You are critically injured. Use /rest before challenging anyone.`);
    return;
  }

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);

  // Find target by username or mention
  const targetInput = parts[0]?.replace("@", "").toLowerCase();
  const manaBet = Math.max(0, parseInt(parts[1] || "50", 10) || 50);

  if (!targetInput) {
    await ctx.replyWithHTML(
      `⚔️ Usage: /pvp @username [mana bet]\nExample: /pvp @SungJinWoo 100\n\nUse /pvp to see online hunters.`,
    );
    return;
  }

  const allHunters = await db.select().from(huntersTable);
  const target = allHunters.find(
    (h) => (h.username || "").toLowerCase() === targetInput ||
      (h.firstName || "").toLowerCase() === targetInput,
  );

  if (!target || target.id === challenger.id) {
    await ctx.replyWithHTML(`⚠️ Hunter "<b>${targetInput}</b>" not found or is yourself.\nUse /pvp to see online hunters.`);
    return;
  }

  if (challenger.manaCoin < manaBet) {
    await ctx.replyWithHTML(
      `💎 Insufficient Mana Coins for the bet.\nYou have: <b>${challenger.manaCoin}</b> MC\nBet: <b>${manaBet}</b> MC`,
    );
    return;
  }

  // Store pending challenge
  pendingChallenges.set(challenger.id, {
    defenderId: target.id,
    expiry: Date.now() + 60_000,
    manaBet,
  });

  const challName = challenger.firstName || challenger.username || `Hunter#${challenger.id}`;
  const targName = target.firstName || target.username || `Hunter#${target.id}`;
  const challRankE = RANK_EMOJIS[challenger.rank] || "⬜";
  const targRankE = RANK_EMOJIS[target.rank] || "⬜";

  // Notify challenger
  await ctx.replyWithHTML(
    `⚔️ <b>CHALLENGE SENT!</b>\n\n` +
      `You challenged ${targRankE} <b>${targName}</b>\n` +
      `💎 Mana Coins at stake: <b>${manaBet}</b>\n\n` +
      `Waiting for response... (60 seconds)`,
  );

  // Notify target
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(
        target.telegramId,
        `⚔️ <b>PvP CHALLENGE!</b>\n\n` +
          `${challRankE} <b>${challName}</b> (Lv.${challenger.level} [${challenger.rank}]) challenges you!\n` +
          `📍 Location: <b>${challenger.location}</b>\n` +
          `💎 Mana Coins at stake: <b>${manaBet} MC</b> each\n\n` +
          `Do you accept?`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Accept Challenge", callback_data: `pvp_accept_${challenger.id}` },
                { text: "❌ Decline", callback_data: `pvp_decline_${challenger.id}` },
              ],
            ],
          },
        },
      );
    } catch (err) {
      logger.warn({ err }, "Could not notify PvP target");
    }
  }
}

export async function handlePvpAccept(ctx: Context, challengerId: number): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  await ctx.answerCbQuery();

  const [defender] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!defender) return;

  const pending = pendingChallenges.get(challengerId);
  if (!pending || pending.defenderId !== defender.id || pending.expiry < Date.now()) {
    await ctx.replyWithHTML(`⚠️ This challenge has expired or is invalid.`);
    pendingChallenges.delete(challengerId);
    return;
  }

  pendingChallenges.delete(challengerId);

  const [challenger] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.id, challengerId));

  if (!challenger) {
    await ctx.replyWithHTML(`⚠️ Challenger not found.`);
    return;
  }

  if (defender.manaCoin < pending.manaBet) {
    await ctx.replyWithHTML(`💎 Insufficient Mana Coins for this bet (need ${pending.manaBet} MC).`);
    return;
  }

  // Simulate PvP combat (use hunter as "monster" proxy)
  const challengerAsMonster: Monster = {
    name: challenger.firstName || challenger.username || `Hunter#${challenger.id}`,
    rank: challenger.rank,
    hp: challenger.hp,
    strength: challenger.strength,
    xpReward: 0,
    goldReward: 0,
    description: "",
    emoji: "⚔️",
    dropChance: 0,
    possibleDrops: [],
  };

  const defenderAsMonster: Monster = {
    name: defender.firstName || defender.username || `Hunter#${defender.id}`,
    rank: defender.rank,
    hp: defender.hp,
    strength: defender.strength,
    xpReward: 0,
    goldReward: 0,
    description: "",
    emoji: "🛡️",
    dropChance: 0,
    possibleDrops: [],
  };

  // Challenger attacks defender
  const result = simulateCombat(challenger, defenderAsMonster);
  const challWon = result.won;

  const winner = challWon ? challenger : defender;
  const loser = challWon ? defender : challenger;
  const manaGain = pending.manaBet;
  const xpGain = Math.floor((winner.level + loser.level) * 10);

  const challName = challenger.firstName || challenger.username || `Hunter#${challenger.id}`;
  const defName = defender.firstName || defender.username || `Hunter#${defender.id}`;
  const challRankE = RANK_EMOJIS[challenger.rank] || "⬜";
  const defRankE = RANK_EMOJIS[defender.rank] || "⬜";

  // Update winner
  await db
    .update(huntersTable)
    .set({
      manaCoin: winner.manaCoin + manaGain,
      xp: Math.min(winner.xp + xpGain, winner.xpToNextLevel),
      pvpWins: winner.pvpWins + 1,
      lastSeen: new Date(),
    })
    .where(eq(huntersTable.id, winner.id));

  // Update loser
  const loserMana = Math.max(0, loser.manaCoin - manaGain);
  await db
    .update(huntersTable)
    .set({
      manaCoin: loserMana,
      hp: Math.max(1, loser.hp - result.damageTaken),
      pvpLosses: loser.pvpLosses + 1,
      lastSeen: new Date(),
    })
    .where(eq(huntersTable.id, loser.id));

  // Log PvP
  await db.insert(pvpLogTable).values({
    challengerId: challenger.id,
    defenderId: defender.id,
    winnerId: winner.id,
    manaCoinTransferred: manaGain,
  });

  const combatLog = result.log.slice(0, 3).join("\n");
  const resultMsg =
    `⚔️ <b>PvP BATTLE RESULT</b> ⚔️\n\n` +
    `${challRankE} <b>${challName}</b> (Lv.${challenger.level}) VS ${defRankE} <b>${defName}</b> (Lv.${defender.level})\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${combatLog}\n\n` +
    `🏆 <b>WINNER: ${challWon ? challName : defName}</b>\n\n` +
    `💎 Mana Coins transferred: <b>${manaGain} MC</b>\n` +
    `✨ XP gained by winner: <b>+${xpGain}</b>`;

  await ctx.replyWithHTML(resultMsg);

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(challenger.telegramId, resultMsg, { parse_mode: "HTML" });
    } catch {}
  }
}

export async function handlePvpDecline(ctx: Context, challengerId: number): Promise<void> {
  await ctx.answerCbQuery("Challenge declined!");
  pendingChallenges.delete(challengerId);
  await ctx.replyWithHTML(`❌ Challenge declined.`);
  if (botInstance) {
    const [challenger] = await db.select().from(huntersTable).where(eq(huntersTable.id, challengerId));
    if (challenger) {
      try {
        await botInstance.telegram.sendMessage(
          challenger.telegramId,
          `❌ Your PvP challenge was declined.`,
        );
      } catch {}
    }
  }
}

export async function handlePvpDirectChallenge(ctx: Context, targetId: number, manaBet: number): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;

  const [challenger] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!challenger) return;

  const [target] = await db.select().from(huntersTable).where(eq(huntersTable.id, targetId));
  if (!target) return;

  pendingChallenges.set(challenger.id, {
    defenderId: target.id,
    expiry: Date.now() + 60_000,
    manaBet,
  });

  const challName = challenger.firstName || challenger.username || `Hunter#${challenger.id}`;
  const targName = target.firstName || target.username || `Hunter#${target.id}`;
  const challRankE = RANK_EMOJIS[challenger.rank] || "⬜";

  await ctx.replyWithHTML(
    `⚔️ Challenge sent to <b>${targName}</b>!\n💎 Bet: <b>${manaBet} MC</b>`,
  );

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(
        target.telegramId,
        `⚔️ <b>PvP CHALLENGE!</b>\n\n${challRankE} <b>${challName}</b> (Lv.${challenger.level}) challenges you!\n💎 Mana Coins at stake: <b>${manaBet} MC</b> each`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Accept", callback_data: `pvp_accept_${challenger.id}` },
              { text: "❌ Decline", callback_data: `pvp_decline_${challenger.id}` },
            ]],
          },
        },
      );
    } catch {}
  }
}
