import type { Context } from "telegraf";
import { db, huntersTable, bannedUsersTable, botConfigTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { logger } from "../../lib/logger";
import type { Telegraf } from "telegraf";
import { getXpForLevel, getRankForLevel, getBaseStatsForLevel } from "../utils/ranks";

export const OWNER_ID = "2086993762";

let botInstance: Telegraf | null = null;
export function setOwnerBotInstance(bot: Telegraf): void { botInstance = bot; }

function isOwner(ctx: Context): boolean {
  return String(ctx.from?.id) === OWNER_ID;
}

export async function handleOwnerPanel(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }

  const totalHunters = await db.select().from(huntersTable);
  const banned = await db.select().from(bannedUsersTable);

  await ctx.replyWithHTML(
    `🛡️ <b>OWNER CONTROL PANEL</b>\n` +
    `👑 Shadow Monarch Admin\n\n` +
    `📊 <b>Bot Stats:</b>\n` +
    `👥 Total Hunters: <b>${totalHunters.length}</b>\n` +
    `🚫 Banned: <b>${banned.length}</b>\n\n` +
    `━━━━━ COMMANDS ━━━━━\n` +
    `/addgold @user [amount]\n` +
    `/addmana @user [amount]\n` +
    `/setlevel @user [level]\n` +
    `/ban @user [reason]\n` +
    `/unban @user\n` +
    `/broadcast [message]\n` +
    `/resetuser @user\n` +
    `/setupi [your_upi_id]\n` +
    `/ownerlist — list all hunters`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 List All Hunters", callback_data: "owner_list" }],
          [{ text: "🚫 Banned Users", callback_data: "owner_banned" }],
        ],
      },
    },
  );
}

export async function handleAddGold(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const username = (parts[0] || "").replace("@", "").toLowerCase();
  const amount = parseInt(parts[1] || "0", 10);
  if (!username || !amount) { await ctx.replyWithHTML(`Usage: /addgold @username [amount]`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }

  await db.update(huntersTable).set({ gold: target.gold + amount }).where(eq(huntersTable.id, target.id));
  await ctx.replyWithHTML(`✅ Added <b>${amount.toLocaleString()}g</b> to <b>${target.firstName || target.username}</b>.\nNew balance: <b>${(target.gold + amount).toLocaleString()}g</b>`);
  logger.info({ targetId: target.telegramId, amount }, "Owner added gold");
}

export async function handleAddMana(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const username = (parts[0] || "").replace("@", "").toLowerCase();
  const amount = parseInt(parts[1] || "0", 10);
  if (!username || !amount) { await ctx.replyWithHTML(`Usage: /addmana @username [amount]`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }

  await db.update(huntersTable).set({ manaCoin: target.manaCoin + amount }).where(eq(huntersTable.id, target.id));
  await ctx.replyWithHTML(`✅ Added <b>${amount.toLocaleString()} MC</b> to <b>${target.firstName || target.username}</b>.\nNew balance: <b>${(target.manaCoin + amount).toLocaleString()} MC</b>`);
}

export async function handleSetLevel(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const username = (parts[0] || "").replace("@", "").toLowerCase();
  const level = Math.max(1, Math.min(100, parseInt(parts[1] || "1", 10)));
  if (!username) { await ctx.replyWithHTML(`Usage: /setlevel @username [level]`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }

  const stats = getBaseStatsForLevel(level);
  const newRank = getRankForLevel(level);
  const xpToNext = getXpForLevel(level);

  await db.update(huntersTable).set({
    level, rank: newRank, xp: 0, xpToNextLevel: xpToNext,
    maxHp: stats.maxHp, hp: stats.maxHp,
    maxMp: stats.maxMp, mp: stats.maxMp,
    strength: stats.strength, agility: stats.agility,
    intelligence: stats.intelligence, perception: stats.perception,
  }).where(eq(huntersTable.id, target.id));

  await ctx.replyWithHTML(`✅ <b>${target.firstName || target.username}</b> set to Level <b>${level}</b> [${newRank}]`);

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(target.telegramId,
        `⚡ <b>[ SYSTEM ]</b>\nThe Shadow Monarch has altered your power.\n\n` +
        `New Level: <b>${level}</b> | Rank: <b>${newRank}</b>`, { parse_mode: "HTML" });
    } catch {}
  }
}

export async function handleBanUser(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const username = (parts[0] || "").replace("@", "").toLowerCase();
  const reason = parts.slice(1).join(" ") || "Violated terms of service";
  if (!username) { await ctx.replyWithHTML(`Usage: /ban @username [reason]`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }
  if (target.telegramId === OWNER_ID) { await ctx.replyWithHTML(`⚠️ Cannot ban the owner.`); return; }

  await db.update(huntersTable).set({ isBanned: true }).where(eq(huntersTable.id, target.id));
  try {
    await db.insert(bannedUsersTable).values({ telegramId: target.telegramId, reason });
  } catch {}

  await ctx.replyWithHTML(`🚫 <b>${target.firstName || target.username}</b> has been banned.\nReason: <i>${reason}</i>`);
  logger.info({ targetId: target.telegramId, reason }, "Owner banned user");
}

export async function handleUnbanUser(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const username = text.split(" ")[1]?.replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /unban @username`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }

  await db.update(huntersTable).set({ isBanned: false }).where(eq(huntersTable.id, target.id));
  try { await db.delete(bannedUsersTable).where(eq(bannedUsersTable.telegramId, target.telegramId)); } catch {}

  await ctx.replyWithHTML(`✅ <b>${target.firstName || target.username}</b> has been unbanned.`);
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(target.telegramId,
        `✅ <b>[ SYSTEM ]</b>\nYour hunter account has been reinstated. Welcome back.`, { parse_mode: "HTML" });
    } catch {}
  }
}

export async function handleBroadcast(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const message = text.split(" ").slice(1).join(" ");
  if (!message) { await ctx.replyWithHTML(`Usage: /broadcast [message]`); return; }

  const allHunters = await db.select().from(huntersTable).where(eq(huntersTable.isBanned, false));
  let sent = 0, failed = 0;

  const broadcastMsg = `📢 <b>[ SYSTEM BROADCAST ]</b>\n\n${message}\n\n<i>— Shadow Monarch Administration</i>`;

  for (const h of allHunters) {
    if (botInstance) {
      try {
        await botInstance.telegram.sendMessage(h.telegramId, broadcastMsg, { parse_mode: "HTML" });
        sent++;
        await new Promise((r) => setTimeout(r, 50)); // rate limiting
      } catch { failed++; }
    }
  }

  await ctx.replyWithHTML(`📢 <b>Broadcast complete!</b>\n✅ Delivered: <b>${sent}</b>\n❌ Failed: <b>${failed}</b>`);
}

export async function handleResetUser(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const username = text.split(" ")[1]?.replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /resetuser @username`); return; }

  const target = await findHunter(username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }

  await db.update(huntersTable).set({
    rank: "E", level: 1, xp: 0, xpToNextLevel: 100,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50,
    strength: 10, agility: 8, intelligence: 6, perception: 7,
    gold: 500, manaCoin: 0, dungeonKeys: 3, statPoints: 0,
    wins: 0, losses: 0, pvpWins: 0, pvpLosses: 0,
    monstersKilled: 0, dungeonsCleared: 0, premiumCharacter: null,
    lastHunt: null, lastSpin: null, lastKilledMonster: null,
  }).where(eq(huntersTable.id, target.id));

  await ctx.replyWithHTML(`🔄 <b>${target.firstName || target.username}</b>'s account has been reset to default.`);
}

export async function handleOwnerList(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const hunters = await db.select().from(huntersTable);
  const lines = hunters.slice(0, 20).map((h, i) =>
    `${i + 1}. <b>${h.firstName || h.username || `#${h.id}`}</b> [${h.rank}] Lv.${h.level} | 💰${h.gold.toLocaleString()} | 💎${h.manaCoin}${h.isBanned ? " 🚫" : ""}`
  );
  await ctx.replyWithHTML(`📋 <b>ALL HUNTERS (${hunters.length} total)</b>\n\n${lines.join("\n")}` +
    (hunters.length > 20 ? `\n<i>...and ${hunters.length - 20} more</i>` : ""));
}

export async function handleSetUpi(ctx: Context): Promise<void> {
  if (!isOwner(ctx)) { await ctx.replyWithHTML(`🚫 Access denied.`); return; }
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.trim().split(/\s+/);
  const upiId = parts[1]?.trim();
  const ownerName = parts[2]?.trim() || "SoloLevelingRPG";

  if (!upiId) {
    await ctx.replyWithHTML(
      `Usage: <code>/setupi [upi_id] [display_name]</code>\n` +
      `Example: <code>/setupi yourname@paytm YourName</code>\n\n` +
      `The UPI ID is saved permanently in the database.`,
    );
    return;
  }

  await db.insert(botConfigTable).values({ key: "upi_id", value: upiId })
    .onConflictDoUpdate({ target: botConfigTable.key, set: { value: upiId, updatedAt: new Date() } });
  await db.insert(botConfigTable).values({ key: "owner_name", value: ownerName })
    .onConflictDoUpdate({ target: botConfigTable.key, set: { value: ownerName, updatedAt: new Date() } });

  await ctx.replyWithHTML(
    `✅ <b>Payment settings saved!</b>\n\n` +
    `UPI ID: <code>${upiId}</code>\n` +
    `Display Name: <b>${ownerName}</b>\n\n` +
    `Players can now use /payment to pay. QR codes will work correctly.`,
  );
}

async function findHunter(usernameOrName: string) {
  const all = await db.select().from(huntersTable);
  return all.find(h =>
    (h.username || "").toLowerCase() === usernameOrName ||
    (h.firstName || "").toLowerCase() === usernameOrName
  ) || null;
}
