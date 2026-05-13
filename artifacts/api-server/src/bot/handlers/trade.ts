import type { Context } from "telegraf";
import { Telegraf } from "telegraf";
import { db, huntersTable, tradeOffersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";
import { logger } from "../../lib/logger";

let botInstance: Telegraf | null = null;
export function setTradeBotInstance(bot: Telegraf): void {
  botInstance = bot;
}

export async function handleTrade(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [sender] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!sender) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);

  if (parts.length < 2) {
    await ctx.replyWithHTML(
      `💱 <b>TRADE SYSTEM</b>\n\n` +
        `Send Mana Coins or Gold to other hunters!\n\n` +
        `Usage:\n` +
        `/trade @username [amount] mana\n` +
        `/trade @username [amount] gold\n\n` +
        `Examples:\n` +
        `<code>/trade @SungJinWoo 100 mana</code>\n` +
        `<code>/trade @SungJinWoo 500 gold</code>\n\n` +
        `💎 Your Mana Coins: <b>${sender.manaCoin}</b>\n` +
        `💰 Your Gold: <b>${sender.gold}</b>`,
    );
    return;
  }

  const targetUsername = parts[0].replace("@", "").toLowerCase();
  const amount = parseInt(parts[1], 10);
  const currency = (parts[2] || "mana").toLowerCase();

  if (isNaN(amount) || amount <= 0) {
    await ctx.replyWithHTML(`⚠️ Invalid amount. Must be a positive number.`);
    return;
  }

  if (currency !== "mana" && currency !== "gold") {
    await ctx.replyWithHTML(`⚠️ Invalid currency. Use "mana" or "gold".`);
    return;
  }

  const allHunters = await db.select().from(huntersTable);
  const target = allHunters.find(
    (h) => (h.username || "").toLowerCase() === targetUsername ||
      (h.firstName || "").toLowerCase() === targetUsername,
  );

  if (!target || target.id === sender.id) {
    await ctx.replyWithHTML(`⚠️ Hunter "<b>${targetUsername}</b>" not found.`);
    return;
  }

  // Check funds
  if (currency === "mana" && sender.manaCoin < amount) {
    await ctx.replyWithHTML(
      `💎 Insufficient Mana Coins.\nYou have: <b>${sender.manaCoin} MC</b>\nRequired: <b>${amount} MC</b>`,
    );
    return;
  }
  if (currency === "gold" && sender.gold < amount) {
    await ctx.replyWithHTML(
      `💰 Insufficient Gold.\nYou have: <b>${sender.gold}g</b>\nRequired: <b>${amount}g</b>`,
    );
    return;
  }

  // Create pending trade
  const [trade] = await db
    .insert(tradeOffersTable)
    .values({
      fromId: sender.id,
      toId: target.id,
      manaCoins: currency === "mana" ? amount : 0,
      gold: currency === "gold" ? amount : 0,
      status: "pending",
    })
    .returning();

  const senderName = sender.firstName || sender.username || `Hunter#${sender.id}`;
  const targetName = target.firstName || target.username || `Hunter#${target.id}`;
  const senderRankE = RANK_EMOJIS[sender.rank] || "⬜";
  const currencyLabel = currency === "mana" ? `${amount} 💎 Mana Coins` : `${amount} 💰 Gold`;

  await ctx.replyWithHTML(
    `💱 <b>TRADE OFFER SENT</b>\n\n` +
      `To: <b>${targetName}</b>\n` +
      `Amount: <b>${currencyLabel}</b>\n\n` +
      `Waiting for their acceptance... (2 minutes)`,
  );

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(
        target.telegramId,
        `💱 <b>TRADE OFFER!</b>\n\n` +
          `${senderRankE} <b>${senderName}</b> wants to send you:\n` +
          `<b>${currencyLabel}</b>\n\n` +
          `Do you accept?`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Accept", callback_data: `trade_accept_${trade.id}` },
              { text: "❌ Decline", callback_data: `trade_decline_${trade.id}` },
            ]],
          },
        },
      );
    } catch (err) {
      logger.warn({ err }, "Could not notify trade target");
    }
  }
}

export async function handleTradeAccept(ctx: Context, tradeId: number): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  await ctx.answerCbQuery();

  const [receiver] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!receiver) return;

  const [trade] = await db
    .select()
    .from(tradeOffersTable)
    .where(eq(tradeOffersTable.id, tradeId));

  if (!trade || trade.toId !== receiver.id || trade.status !== "pending") {
    await ctx.replyWithHTML(`⚠️ Trade not found or already expired.`);
    return;
  }

  const expiryMs = trade.createdAt.getTime() + 2 * 60 * 1000;
  if (Date.now() > expiryMs) {
    await db.update(tradeOffersTable).set({ status: "expired" }).where(eq(tradeOffersTable.id, tradeId));
    await ctx.replyWithHTML(`⚠️ Trade offer has expired.`);
    return;
  }

  const [sender] = await db.select().from(huntersTable).where(eq(huntersTable.id, trade.fromId));
  if (!sender) return;

  // Deduct from sender, add to receiver
  if (trade.manaCoins > 0) {
    if (sender.manaCoin < trade.manaCoins) {
      await ctx.replyWithHTML(`⚠️ Sender no longer has enough Mana Coins.`);
      await db.update(tradeOffersTable).set({ status: "declined" }).where(eq(tradeOffersTable.id, tradeId));
      return;
    }
    await db.update(huntersTable).set({ manaCoin: sender.manaCoin - trade.manaCoins }).where(eq(huntersTable.id, sender.id));
    await db.update(huntersTable).set({ manaCoin: receiver.manaCoin + trade.manaCoins }).where(eq(huntersTable.id, receiver.id));
  }
  if (trade.gold > 0) {
    if (sender.gold < trade.gold) {
      await ctx.replyWithHTML(`⚠️ Sender no longer has enough Gold.`);
      await db.update(tradeOffersTable).set({ status: "declined" }).where(eq(tradeOffersTable.id, tradeId));
      return;
    }
    await db.update(huntersTable).set({ gold: sender.gold - trade.gold }).where(eq(huntersTable.id, sender.id));
    await db.update(huntersTable).set({ gold: receiver.gold + trade.gold }).where(eq(huntersTable.id, receiver.id));
  }

  await db.update(tradeOffersTable).set({ status: "accepted" }).where(eq(tradeOffersTable.id, tradeId));

  const senderName = sender.firstName || sender.username || `Hunter#${sender.id}`;
  const receiverName = receiver.firstName || receiver.username || `Hunter#${receiver.id}`;
  const currencyLabel = trade.manaCoins > 0
    ? `${trade.manaCoins} 💎 Mana Coins`
    : `${trade.gold} 💰 Gold`;

  const resultMsg =
    `✅ <b>TRADE COMPLETE!</b>\n\n` +
    `<b>${senderName}</b> → <b>${receiverName}</b>\n` +
    `Amount: <b>${currencyLabel}</b>`;

  await ctx.replyWithHTML(resultMsg);

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(sender.telegramId, resultMsg, { parse_mode: "HTML" });
    } catch {}
  }
}

export async function handleTradeDecline(ctx: Context, tradeId: number): Promise<void> {
  await ctx.answerCbQuery("Trade declined!");
  const [trade] = await db.select().from(tradeOffersTable).where(eq(tradeOffersTable.id, tradeId));
  if (trade) {
    await db.update(tradeOffersTable).set({ status: "declined" }).where(eq(tradeOffersTable.id, tradeId));
    const [sender] = await db.select().from(huntersTable).where(eq(huntersTable.id, trade.fromId));
    if (sender && botInstance) {
      try {
        await botInstance.telegram.sendMessage(sender.telegramId, `❌ Your trade offer was declined.`);
      } catch {}
    }
  }
  await ctx.replyWithHTML(`❌ Trade declined.`);
}
