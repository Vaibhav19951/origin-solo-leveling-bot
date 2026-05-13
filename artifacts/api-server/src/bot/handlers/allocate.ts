import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const VALID_STATS = ["str", "agi", "int", "per", "hp"];

export async function handleAllocate(ctx: Context): Promise<void> {
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

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const stat = parts[0]?.toLowerCase();
  const amount = parseInt(parts[1] || "1", 10);

  if (!stat || !VALID_STATS.includes(stat) || isNaN(amount) || amount < 1) {
    await ctx.replyWithHTML(
      `⭐ <b>STAT ALLOCATION</b>\n\n` +
        `Available stat points: <b>${hunter.statPoints}</b>\n\n` +
        `Stats you can allocate:\n` +
        `• <b>str</b> — Strength (+3 per point)\n` +
        `• <b>agi</b> — Agility (+2 per point)\n` +
        `• <b>int</b> — Intelligence (+2 per point)\n` +
        `• <b>per</b> — Perception (+2 per point)\n` +
        `• <b>hp</b> — Max HP (+50 per point)\n\n` +
        `Usage: /allocate [stat] [amount]\n` +
        `Example: /allocate str 5`,
    );
    return;
  }

  if (hunter.statPoints < amount) {
    await ctx.replyWithHTML(
      `⚠️ Not enough stat points.\nYou have <b>${hunter.statPoints}</b> points but tried to spend <b>${amount}</b>.`,
    );
    return;
  }

  const updates: Partial<typeof hunter> = {
    statPoints: hunter.statPoints - amount,
  };

  let statDesc = "";
  if (stat === "str") {
    updates.strength = hunter.strength + amount * 3;
    statDesc = `⚔️ STR: <b>${hunter.strength} → ${updates.strength}</b>`;
  } else if (stat === "agi") {
    updates.agility = hunter.agility + amount * 2;
    statDesc = `🏃 AGI: <b>${hunter.agility} → ${updates.agility}</b>`;
  } else if (stat === "int") {
    updates.intelligence = hunter.intelligence + amount * 2;
    statDesc = `🔮 INT: <b>${hunter.intelligence} → ${updates.intelligence}</b>`;
  } else if (stat === "per") {
    updates.perception = hunter.perception + amount * 2;
    statDesc = `👁️ PER: <b>${hunter.perception} → ${updates.perception}</b>`;
  } else if (stat === "hp") {
    const hpGain = amount * 50;
    updates.maxHp = hunter.maxHp + hpGain;
    updates.hp = hunter.hp + hpGain;
    statDesc = `❤️ Max HP: <b>${hunter.maxHp} → ${updates.maxHp}</b>`;
  }

  await db.update(huntersTable).set(updates).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `⭐ <b>STATS ALLOCATED</b>\n\n` +
      `${statDesc}\n` +
      `Remaining points: <b>${hunter.statPoints - amount}</b>`,
  );
}
