import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function handleRest(ctx: Context): Promise<void> {
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

  if (hunter.hp >= hunter.maxHp) {
    await ctx.replyWithHTML(
      `😴 <b>[ SYSTEM ]</b>\nYou are already at full health.\n❤️ HP: <b>${hunter.hp}/${hunter.maxHp}</b>`,
    );
    return;
  }

  // Free rest restores 50% of missing HP
  const missing = hunter.maxHp - hunter.hp;
  const freeRestore = Math.floor(missing * 0.5);
  const newHp = hunter.hp + freeRestore;

  await db
    .update(huntersTable)
    .set({ hp: newHp })
    .where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `😴 <b>REST COMPLETE</b>\n\n` +
    `You find a moment of peace and recover.\n\n` +
    `❤️ HP: <b>${hunter.hp} → ${newHp}/${hunter.maxHp}</b>\n\n` +
    `<i>Tip: Use HP Potions for full recovery, or /daily to fully restore HP.</i>`,
  );
}
