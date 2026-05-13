import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AURAS, getAuraById, canUnlockAura, getAuraDisplay } from "../data/auras";
import { RANK_EMOJIS } from "../utils/ranks";

const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

function parseOwnedAuras(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

export async function handleAura(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const ownedIds = parseOwnedAuras(hunter.ownedAuras);
  const currentAura = getAuraById(hunter.currentAura);
  const owned = AURAS.filter((a) => ownedIds.includes(a.id) || a.id === "hunter");

  const ownedList = owned.map((a) => {
    const active = hunter.currentAura === a.id ? " ✅ <b>(Active)</b>" : "";
    const bonuses = buildBonusStr(a);
    return `${a.emoji} <b>${a.name}</b>${active}${bonuses ? `\n   Bonus: ${bonuses}` : ""}`;
  }).join("\n\n");

  await ctx.replyWithHTML(
    `✨ <b>AURA SYSTEM</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `${RANK_EMOJIS[hunter.rank] || "⬜"} Rank <b>${hunter.rank}</b>  |  Lv.<b>${hunter.level}</b>\n\n` +
    `<b>Current Aura:</b> ${getAuraDisplay(currentAura)}\n\n` +
    `<b>Your Auras (${owned.length}):</b>\n${ownedList || "None yet"}\n\n` +
    `Use /setaura [name] to equip an aura\nBrowse all auras with /aurastore`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "🛒 Browse Aura Store", callback_data: "action_aurastore" },
          { text: "📊 Profile", callback_data: "action_profile" },
        ]],
      },
    },
  );
}

export async function handleSetAura(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const auraQuery = text.split(" ").slice(1).join(" ").toLowerCase().trim();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!auraQuery) {
    await ctx.replyWithHTML(`Usage: /setaura [aura name]\nExample: /setaura flame\n\nSee all auras: /aura\nBrowse store: /aurastore`);
    return;
  }

  const aura = AURAS.find((a) =>
    a.id === auraQuery || a.name.toLowerCase().includes(auraQuery)
  );
  if (!aura) { await ctx.replyWithHTML(`⚠️ Aura "<b>${auraQuery}</b>" not found.\nUse /aurastore to see available auras.`); return; }

  const ownedIds = parseOwnedAuras(hunter.ownedAuras);
  const isOwned = ownedIds.includes(aura.id) || aura.id === "hunter";
  if (!isOwned) {
    await ctx.replyWithHTML(
      `⚠️ You don't own <b>${aura.name}</b>.\n\nCost: <b>${aura.costMC} MC</b> | Rank Required: <b>${aura.rankRequired}</b>\n\nPurchase it with: /buyaura ${aura.id}`,
    );
    return;
  }

  await db.update(huntersTable).set({ currentAura: aura.id }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `${aura.emoji} <b>AURA EQUIPPED!</b>\n\n<b>${aura.name}</b> is now active.\n<i>${aura.description}</i>` +
    (buildBonusStr(aura) ? `\n\n✨ Bonuses: ${buildBonusStr(aura)}` : ""),
  );
}

export async function handleAuraStore(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const ownedIds = parseOwnedAuras(hunter.ownedAuras);
  const hunterRankIdx = RANK_ORDER.indexOf(hunter.rank === "NLH" ? "NLH" : hunter.rank);

  const lines = AURAS.map((a) => {
    const owned = ownedIds.includes(a.id) || a.id === "hunter";
    const canUnlock = canUnlockAura(hunter.rank, a);
    const rankIdx = RANK_ORDER.indexOf(a.rankRequired);
    const locked = rankIdx > hunterRankIdx;
    const status = owned ? "✅ Owned" : locked ? `🔒 Rank ${a.rankRequired}` : `💎 ${a.costMC} MC`;
    const bonuses = buildBonusStr(a);
    return `${a.emoji} <b>${a.name}</b> — ${status}\n   <i>${a.description}</i>${bonuses ? `\n   Bonus: ${bonuses}` : ""}`;
  }).join("\n\n");

  await ctx.replyWithHTML(
    `✨ <b>AURA STORE</b>\n` +
    `💎 Your MC: <b>${hunter.manaCoin}</b>  |  Rank: <b>${hunter.rank}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    lines +
    `\n\nPurchase: /buyaura [name]\nEquip owned: /setaura [name]`,
  );
}

export async function handleBuyAura(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const auraQuery = text.split(" ").slice(1).join(" ").toLowerCase().trim();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!auraQuery) { await ctx.replyWithHTML(`Usage: /buyaura [aura name]\nBrowse: /aurastore`); return; }

  const aura = AURAS.find((a) => a.id === auraQuery || a.name.toLowerCase().includes(auraQuery));
  if (!aura) { await ctx.replyWithHTML(`⚠️ Aura not found. Check /aurastore`); return; }
  if (aura.id === "hunter") { await ctx.replyWithHTML(`✅ Hunter's Aura is free and already unlocked!`); return; }

  const ownedIds = parseOwnedAuras(hunter.ownedAuras);
  if (ownedIds.includes(aura.id)) { await ctx.replyWithHTML(`✅ You already own <b>${aura.name}</b>!\nEquip it: /setaura ${aura.id}`); return; }

  if (!canUnlockAura(hunter.rank, aura)) {
    await ctx.replyWithHTML(`🔒 <b>${aura.name}</b> requires Rank <b>${aura.rankRequired}</b>.\nYour rank: <b>${hunter.rank}</b>`);
    return;
  }

  if (hunter.manaCoin < aura.costMC) {
    await ctx.replyWithHTML(`💎 Insufficient Mana Coins!\nCost: <b>${aura.costMC} MC</b> | You have: <b>${hunter.manaCoin} MC</b>\n\nEarn MC from PvP wins, dungeons, and /spin`);
    return;
  }

  ownedIds.push(aura.id);
  const newManaCoin = hunter.manaCoin - aura.costMC;
  const newMaxHp = hunter.maxHp + (aura.bonusHp || 0);
  const newStr = hunter.strength + (aura.bonusStr || 0);
  const newAgi = hunter.agility + (aura.bonusAgi || 0);
  const newInt = hunter.intelligence + (aura.bonusInt || 0);

  await db.update(huntersTable).set({
    manaCoin: newManaCoin,
    ownedAuras: JSON.stringify(ownedIds),
    currentAura: aura.id,
    maxHp: newMaxHp,
    hp: Math.min(hunter.hp + (aura.bonusHp || 0), newMaxHp),
    strength: newStr,
    agility: newAgi,
    intelligence: newInt,
  }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `${aura.emoji} <b>AURA UNLOCKED!</b>\n\n<b>${aura.name}</b> equipped!\n<i>${aura.description}</i>\n\n` +
    `💎 Spent: <b>${aura.costMC} MC</b>  |  Remaining: <b>${newManaCoin} MC</b>` +
    (buildBonusStr(aura) ? `\n\n✨ Bonuses applied: ${buildBonusStr(aura)}` : ""),
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "✨ View Auras", callback_data: "action_aura" },
          { text: "📊 Profile", callback_data: "action_profile" },
        ]],
      },
    },
  );
}

function buildBonusStr(aura: ReturnType<typeof getAuraById>): string {
  if (!aura) return "";
  const parts: string[] = [];
  if (aura.bonusStr) parts.push(`+${aura.bonusStr} STR`);
  if (aura.bonusAgi) parts.push(`+${aura.bonusAgi} AGI`);
  if (aura.bonusInt) parts.push(`+${aura.bonusInt} INT`);
  if (aura.bonusHp) parts.push(`+${aura.bonusHp} HP`);
  if (aura.xpBonus) parts.push(`+${aura.xpBonus}% XP`);
  return parts.join(", ");
}
