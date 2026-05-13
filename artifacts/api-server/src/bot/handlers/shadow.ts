import type { Context } from "telegraf";
import { db, huntersTable, shadowArmyTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";

const SHADOW_NAMES = [
  "Igris", "Beru", "Iron", "Tank", "Tusk", "Kaisel", "Greed", "Architect",
  "Bellion", "Kamish", "Ant King", "Shadow Knight", "Vulcan", "Dusk",
  "Storm", "Void", "Abyss", "Phantom", "Eclipse", "Shade",
];

const MAX_SHADOWS: Record<string, number> = {
  E: 5, D: 10, C: 20, B: 50, A: 100, S: 200, NLH: 500, Monarch: 9999,
};

const SHADOW_COST_MP = 80;

const RANK_SHADOW_POWER: Record<string, { attack: number; hp: number }> = {
  E: { attack: 15, hp: 100 },
  D: { attack: 40, hp: 250 },
  C: { attack: 80, hp: 500 },
  B: { attack: 150, hp: 1000 },
  A: { attack: 300, hp: 2000 },
  S: { attack: 600, hp: 5000 },
};

function generateShadowName(existingNames: string[]): string {
  const available = SHADOW_NAMES.filter((n) => !existingNames.includes(n));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  return `Shadow-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function handleExtract(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!hunter.lastKilledMonster) {
    await ctx.replyWithHTML(
      `🌑 <b>SHADOW EXTRACTION</b>\n\nNo recent kill to extract from.\n\n` +
      `Use /hunt to defeat a monster first, then /extract to attempt shadow extraction.`,
    );
    return;
  }

  const currentShadows = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.hunterId, hunter.id));
  const maxShadows = MAX_SHADOWS[hunter.rank] || 5;

  if (currentShadows.length >= maxShadows) {
    await ctx.replyWithHTML(
      `⚠️ Shadow Army is full! (<b>${currentShadows.length}/${maxShadows}</b>)\n\n` +
      `Rank up to command more shadows.`,
    );
    return;
  }

  if (hunter.mp < SHADOW_COST_MP) {
    await ctx.replyWithHTML(
      `💙 Insufficient MP for extraction.\nRequired: <b>${SHADOW_COST_MP} MP</b> | You have: <b>${hunter.mp} MP</b>\n\nUse /rest or potions to restore MP.`,
    );
    return;
  }

  // Extraction success chance based on INT
  const baseChance = 0.4 + (hunter.intelligence * 0.003);
  const successChance = Math.min(0.85, baseChance);
  const success = Math.random() < successChance;

  await db.update(huntersTable).set({ mp: hunter.mp - SHADOW_COST_MP, lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!success) {
    await ctx.replyWithHTML(
      `🌑 <b>ARISE...</b>\n\n` +
      `❌ <b>Extraction Failed!</b>\n` +
      `The soul of <b>${hunter.lastKilledMonster}</b> resisted.\n\n` +
      `💙 MP consumed: <b>${SHADOW_COST_MP}</b>\n` +
      `Success chance: <b>${Math.round(successChance * 100)}%</b>\n\n` +
      `<i>Tip: Higher INT stat improves extraction chance!</i>`,
    );
    return;
  }

  const monsterRank = hunter.lastKilledMonsterRank || "E";
  const power = RANK_SHADOW_POWER[monsterRank] || RANK_SHADOW_POWER.E;
  const atk = Math.floor(power.attack * (0.8 + Math.random() * 0.4));
  const hp = Math.floor(power.hp * (0.8 + Math.random() * 0.4));
  const existingNames = currentShadows.map((s) => s.shadowName);
  const shadowName = generateShadowName(existingNames);
  const emoji = hunter.lastKilledMonsterEmoji || "🌑";

  await db.insert(shadowArmyTable).values({
    hunterId: hunter.id,
    shadowName,
    monsterName: hunter.lastKilledMonster,
    monsterRank,
    attack: atk,
    hp,
    level: 1,
    emoji,
  });

  // Clear last killed monster
  await db.update(huntersTable).set({ lastKilledMonster: null, lastKilledMonsterRank: null, lastKilledMonsterEmoji: null }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `🌑 <b>ARISE!</b>\n\n` +
    `✅ Shadow extracted from <b>${hunter.lastKilledMonster}</b>!\n\n` +
    `${emoji} <b>${shadowName}</b> has risen!\n` +
    `⚔️ ATK: <b>${atk}</b>  |  ❤️ HP: <b>${hp}</b>\n` +
    `Rank: <b>${monsterRank}</b>\n\n` +
    `💙 MP consumed: <b>${SHADOW_COST_MP}</b>\n` +
    `👥 Shadow Army: <b>${currentShadows.length + 1}/${maxShadows}</b>\n\n` +
    `<i>Shadow fights alongside you in every battle!</i>`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "🌑 View Army", callback_data: "action_shadows" },
          { text: "⚔️ Hunt Again", callback_data: "action_hunt" },
        ]],
      },
    },
  );
}

export async function handleShadows(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const shadows = await db.select().from(shadowArmyTable).where(eq(shadowArmyTable.hunterId, hunter.id));
  const maxShadows = MAX_SHADOWS[hunter.rank] || 5;
  const totalAtk = shadows.reduce((s, sh) => s + sh.attack, 0);
  const totalHp = shadows.reduce((s, sh) => s + sh.hp, 0);

  if (shadows.length === 0) {
    await ctx.replyWithHTML(
      `🌑 <b>SHADOW ARMY</b>\n\n` +
      `Your army is empty, my liege.\n\n` +
      `Hunt monsters and use /extract after killing them to build your shadow army!\n\n` +
      `💙 MP cost: <b>${SHADOW_COST_MP} MP</b> per extraction\n` +
      `Capacity: <b>0/${maxShadows}</b>`,
    );
    return;
  }

  const byRank = ["S", "A", "B", "C", "D", "E"].reduce<Record<string, typeof shadows>>((acc, r) => {
    const grouped = shadows.filter((s) => s.monsterRank === r);
    if (grouped.length > 0) acc[r] = grouped;
    return acc;
  }, {});

  let shadowList = "";
  for (const [rank, shadowsOfRank] of Object.entries(byRank)) {
    const rankEmoji = RANK_EMOJIS[rank] || "⬜";
    shadowList += `\n${rankEmoji} <b>${rank}-Rank Shadows:</b>\n`;
    shadowList += shadowsOfRank.map((s) => `  ${s.emoji} <b>${s.shadowName}</b> — ATK:${s.attack} | HP:${s.hp}`).join("\n");
  }

  await ctx.replyWithHTML(
    `🌑 <b>SHADOW ARMY</b> 🌑\n` +
    `👥 Soldiers: <b>${shadows.length}/${maxShadows}</b>\n` +
    `⚔️ Total ATK: <b>${totalAtk.toLocaleString()}</b>\n` +
    `❤️ Total HP: <b>${totalHp.toLocaleString()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━` +
    shadowList +
    `\n\n<i>Shadows fight automatically in /hunt battles.</i>\nExtract more: /extract after killing a monster.`,
  );
}
