import type { Context } from "telegraf";
import { db, huntersTable, activeGatesTable } from "@workspace/db";
import { eq, gt, and } from "drizzle-orm";
import { DUNGEONS } from "../data/dungeons";

const GATE_COLORS: Record<string, string> = {
  E: "🔵", D: "🟢", C: "🟡", B: "🟠", A: "🔴", S: "🟣",
};

const GATE_RANK_ORDER = ["E", "D", "C", "B", "A", "S"];

const ZONE_NAMES = [
  "Cartenon Temple", "Demons Castle", "Jeju Island", "Red Gate", "Abyss Gate", "Shadow Realm",
];

function randomZone(): string {
  return ZONE_NAMES[Math.floor(Math.random() * ZONE_NAMES.length)];
}

async function ensureGates(): Promise<void> {
  const now = new Date();
  const existing = await db.select().from(activeGatesTable)
    .where(and(eq(activeGatesTable.isCleared, false), gt(activeGatesTable.expiresAt, now)));

  // Keep 2–3 gates per rank available
  for (const rank of GATE_RANK_ORDER) {
    const rankGates = existing.filter((g) => g.dungeonRank === rank && !g.isCleared);
    if (rankGates.length < 2) {
      const toCreate = 2 - rankGates.length;
      const dungeon = DUNGEONS.find((d) => d.rank === rank) || DUNGEONS[0];
      for (let i = 0; i < toCreate; i++) {
        const expiresAt = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours
        await db.insert(activeGatesTable).values({
          dungeonName: dungeon.name,
          dungeonRank: rank,
          location: randomZone(),
          emoji: GATE_COLORS[rank] || "🔵",
          bossName: dungeon.bossName,
          expiresAt,
        });
      }
    }
  }
}

export async function handleGates(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  // Clean expired / ensure new gates
  await ensureGates();

  const now = new Date();
  const gates = await db.select().from(activeGatesTable)
    .where(and(eq(activeGatesTable.isCleared, false), gt(activeGatesTable.expiresAt, now)));

  if (gates.length === 0) {
    await ctx.replyWithHTML(
      `🌀 <b>ACTIVE GATES</b>\n\nNo active gates detected right now.\nCheck back in a moment — gates open constantly across the world.\n\nUse /dungeon to enter a dungeon directly.`,
    );
    return;
  }

  const hunterRankIdx = GATE_RANK_ORDER.indexOf(hunter.rank === "NLH" || hunter.rank === "Monarch" ? "S" : hunter.rank);

  // Group by rank
  const byRank: Record<string, typeof gates> = {};
  for (const g of gates) {
    if (!byRank[g.dungeonRank]) byRank[g.dungeonRank] = [];
    byRank[g.dungeonRank].push(g);
  }

  let output = `🌀 <b>ACTIVE DUNGEON GATES</b>\n`;
  output += `Your Rank: <b>${hunter.rank}</b> | Keys: 🔑<b>${hunter.dungeonKeys}</b>\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const rank of GATE_RANK_ORDER) {
    if (!byRank[rank]) continue;
    const gateRankIdx = GATE_RANK_ORDER.indexOf(rank);
    const accessible = gateRankIdx <= hunterRankIdx;

    for (const gate of byRank[rank]) {
      const expiresInMs = gate.expiresAt.getTime() - now.getTime();
      const mins = Math.floor(expiresInMs / 60000);
      const hrs = Math.floor(mins / 60);
      const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
      const lock = accessible ? "" : " 🔒";
      output += `${gate.emoji} <b>[${rank}-Rank Gate]</b>${lock}\n`;
      output += `  📍 ${gate.location}\n`;
      output += `  👹 Boss: ${gate.bossName}\n`;
      output += `  ⏳ Closes in: ${timeStr}\n`;
      if (accessible) output += `  <code>/entergate ${gate.id}</code>\n`;
      output += "\n";
    }
  }

  output += `<i>Use /entergate [id] to enter a gate | /dungeon for standard dungeon</i>`;

  await ctx.replyWithHTML(output, {
    reply_markup: {
      inline_keyboard: [[
        { text: "🔑 Enter Dungeon", callback_data: "action_dungeon" },
        { text: "🗺️ World Map", callback_data: "action_map" },
      ]],
    },
  });
}

export async function handleEnterGate(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const gateId = parseInt(text.split(" ")[1] || "0", 10);

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  if (!gateId) { await ctx.replyWithHTML(`Usage: /entergate [gate_id]\nSee gate IDs with /gates`); return; }

  const [gate] = await db.select().from(activeGatesTable).where(eq(activeGatesTable.id, gateId));
  if (!gate) { await ctx.replyWithHTML(`⚠️ Gate #${gateId} not found.`); return; }
  if (gate.isCleared) { await ctx.replyWithHTML(`✅ Gate #${gateId} has already been cleared by another hunter.`); return; }
  if (new Date() > gate.expiresAt) { await ctx.replyWithHTML(`⌛ Gate #${gateId} has already closed.`); return; }

  const hunterRankIdx = GATE_RANK_ORDER.indexOf(hunter.rank === "NLH" || hunter.rank === "Monarch" ? "S" : hunter.rank);
  const gateRankIdx = GATE_RANK_ORDER.indexOf(gate.dungeonRank);
  if (gateRankIdx > hunterRankIdx) {
    await ctx.replyWithHTML(`🔒 Rank <b>${gate.dungeonRank}</b> gate is locked for your rank (<b>${hunter.rank}</b>).\nRank up to enter this gate!`);
    return;
  }

  if (hunter.dungeonKeys <= 0) {
    await ctx.replyWithHTML(`🔑 No dungeon keys! Earn one from /daily or buy from /shop.`);
    return;
  }

  if (hunter.hp <= 0) {
    await ctx.replyWithHTML(`💀 You are too injured to enter a gate. Use /rest first.`);
    return;
  }

  // Mark gate as cleared immediately and redirect to dungeon flow
  await db.update(activeGatesTable).set({ isCleared: true, clearedBy: hunter.id }).where(eq(activeGatesTable.id, gateId));

  await ctx.replyWithHTML(
    `🌀 <b>GATE ENTERED!</b>\n\n${gate.emoji} <b>[${gate.dungeonRank}-Rank Gate]</b>\n` +
    `📍 ${gate.location}\n👹 Boss: <b>${gate.bossName}</b>\n\n` +
    `<i>The gate shudders as you step through...</i>`,
  );

  // Simulate dungeon through command re-use by injecting rank context
  // Redirect to /dungeon [rank]
  const fakeCtx = {
    ...ctx,
    message: { ...ctx.message, text: `/dungeon ${gate.dungeonRank}` },
  } as Context;

  const { handleDungeon } = await import("./dungeon");
  await handleDungeon(fakeCtx);
}
