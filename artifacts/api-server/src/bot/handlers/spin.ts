import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { formatCooldown } from "../utils/format";

const SPIN_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const EXTRA_SPIN_COST = 500; // mana coins

interface SpinPrize {
  label: string;
  emoji: string;
  rarity: string;
  weight: number;
  apply: (hunter: typeof huntersTable.$inferSelect) => { updates: Partial<typeof huntersTable.$inferSelect>; msg: string };
}

const SPIN_PRIZES: SpinPrize[] = [
  {
    label: "JACKPOT", emoji: "🎰", rarity: "JACKPOT", weight: 2,
    apply: (h) => ({ updates: { manaCoin: h.manaCoin + 5000 }, msg: `💎 <b>JACKPOT!</b> You won <b>5,000 Mana Coins!</b>` }),
  },
  {
    label: "Mythic Mana", emoji: "💜", rarity: "MYTHIC", weight: 5,
    apply: (h) => ({
      updates: { manaCoin: h.manaCoin + 1500, gold: h.gold + 30000 },
      msg: `💜 <b>MYTHIC!</b> +1,500 Mana Coins & +30,000 Gold!`,
    }),
  },
  {
    label: "Legend Haul", emoji: "🌟", rarity: "LEGENDARY", weight: 8,
    apply: (h) => ({
      updates: { manaCoin: h.manaCoin + 500, gold: h.gold + 50000 },
      msg: `🌟 <b>LEGENDARY!</b> +500 Mana Coins & +50,000 Gold!`,
    }),
  },
  {
    label: "Epic Loot", emoji: "🔥", rarity: "EPIC", weight: 15,
    apply: (h) => ({
      updates: { manaCoin: h.manaCoin + 200, gold: h.gold + 20000, dungeonKeys: h.dungeonKeys + 3 },
      msg: `🔥 <b>EPIC!</b> +200 Mana Coins, +20,000 Gold, +3 Dungeon Keys!`,
    }),
  },
  {
    label: "Rare Find", emoji: "💎", rarity: "RARE", weight: 20,
    apply: (h) => ({
      updates: { manaCoin: h.manaCoin + 50, gold: h.gold + 5000, dungeonKeys: h.dungeonKeys + 1 },
      msg: `💎 <b>RARE!</b> +50 Mana Coins, +5,000 Gold, +1 Dungeon Key!`,
    }),
  },
  {
    label: "Uncommon", emoji: "🟦", rarity: "UNCOMMON", weight: 25,
    apply: (h) => ({
      updates: { gold: h.gold + 3000, dungeonKeys: h.dungeonKeys + 1, hp: Math.min(h.maxHp, h.hp + 200) },
      msg: `🟦 <b>UNCOMMON!</b> +3,000 Gold, +1 Dungeon Key, +200 HP!`,
    }),
  },
  {
    label: "Common", emoji: "⬜", rarity: "COMMON", weight: 25,
    apply: (h) => ({
      updates: { gold: h.gold + Math.floor(Math.random() * 1500) + 500 },
      msg: `⬜ <b>COMMON.</b> +${Math.floor(Math.random() * 1500) + 500} Gold.`,
    }),
  },
];

function weightedRandom(): SpinPrize {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let rand = Math.random() * total;
  for (const prize of SPIN_PRIZES) {
    rand -= prize.weight;
    if (rand <= 0) return prize;
  }
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}

const SLOT_EMOJIS = ["🎰", "💎", "🌟", "🔥", "👑", "🌑", "⚡", "💜", "🎲", "🏆"];

function randomSlots(): string {
  return [0, 1, 2].map(() => SLOT_EMOJIS[Math.floor(Math.random() * SLOT_EMOJIS.length)]).join(" | ");
}

export async function handleSpin(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const isBuySpin = text.toLowerCase().includes("buy");

  // Check if buying extra spin
  if (isBuySpin) {
    if (hunter.manaCoin < EXTRA_SPIN_COST) {
      await ctx.replyWithHTML(`💎 Extra spin costs <b>${EXTRA_SPIN_COST} Mana Coins</b>.\nYou have: <b>${hunter.manaCoin} MC</b>\n\nEarn MC by winning PvP and clearing dungeons!`);
      return;
    }
    await db.update(huntersTable).set({ manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }).where(eq(huntersTable.id, hunter.id));
    await doSpin(ctx, { ...hunter, manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }, true);
    return;
  }

  // Free spin cooldown check
  if (hunter.lastSpin) {
    const elapsed = Date.now() - hunter.lastSpin.getTime();
    if (elapsed < SPIN_COOLDOWN_MS) {
      const remaining = SPIN_COOLDOWN_MS - elapsed;
      await ctx.replyWithHTML(
        `🎰 <b>SPIN WHEEL</b>\n\nFree spin available in: <b>${formatCooldown(remaining)}</b>\n\n` +
        `💎 Or spin now for <b>${EXTRA_SPIN_COST} Mana Coins!</b>`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: `💎 Buy Extra Spin (${EXTRA_SPIN_COST} MC)`, callback_data: "spin_buy" }]],
          },
        },
      );
      return;
    }
  }

  await doSpin(ctx, hunter, false);
}

async function doSpin(ctx: Context, hunter: typeof huntersTable.$inferSelect, isPaid: boolean): Promise<void> {
  const prize = weightedRandom();
  const result = prize.apply(hunter);

  // Send spinning animation
  const spinMsg = await ctx.replyWithHTML(
    `🎰 <b>SHADOW LOTTERY</b> 🎰\n\n` +
    `[ ${randomSlots()} ]\n\n⏳ <i>Spinning...</i>`,
  );

  await new Promise((r) => setTimeout(r, 800));

  const prizeResult = prize.apply(hunter);
  const finalUpdates = { ...prizeResult.updates, lastSpin: isPaid ? hunter.lastSpin : new Date(), lastSeen: new Date() };
  await db.update(huntersTable).set(finalUpdates).where(eq(huntersTable.id, hunter.id));

  const typeLabel = isPaid ? `💎 Paid Spin (${EXTRA_SPIN_COST} MC used)` : `🆓 Free Spin`;

  const finalMsg =
    `🎰 <b>SHADOW LOTTERY RESULT</b>\n\n` +
    `[ ${prize.emoji} | ${prize.emoji} | ${prize.emoji} ]\n\n` +
    `🏆 Rarity: <b>${prize.rarity}</b>\n\n` +
    `${prizeResult.msg}\n\n` +
    `<i>${typeLabel}</i>` +
    (isPaid ? `` : `\n\nNext free spin in <b>6 hours</b> | /spin buy for extra spin`);

  try {
    await ctx.replyWithHTML(finalMsg, {
      reply_markup: {
        inline_keyboard: [[
          { text: "🎰 Spin Again (Buy)", callback_data: "spin_buy" },
          { text: "📊 Profile", callback_data: "action_profile" },
        ]],
      },
    });
  } catch {
    await ctx.replyWithHTML(finalMsg);
  }
}

export async function handleSpinBuyCallback(ctx: Context): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;
  if (hunter.manaCoin < EXTRA_SPIN_COST) {
    await ctx.answerCbQuery(`❌ Need ${EXTRA_SPIN_COST} MC. You have ${hunter.manaCoin} MC.`, { show_alert: true });
    return;
  }
  await db.update(huntersTable).set({ manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }).where(eq(huntersTable.id, hunter.id));
  await doSpin(ctx, { ...hunter, manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }, true);
}
