import type { Context } from "telegraf";
import { db, huntersTable, botConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PREMIUM_CHARACTERS } from "../data/premium";
import qrcode from "qrcode";
import type { Telegraf } from "telegraf";
import { OWNER_ID } from "./owner";

let botInstance: Telegraf | null = null;
export function setPaymentBotInstance(bot: Telegraf): void { botInstance = bot; }

async function getConfig(key: string): Promise<string | null> {
  const [row] = await db.select().from(botConfigTable).where(eq(botConfigTable.key, key));
  return row?.value ?? null;
}

async function getUpiId(): Promise<string | null> {
  return getConfig("upi_id");
}

async function getOwnerName(): Promise<string> {
  return (await getConfig("owner_name")) ?? "SoloLevelingRPG";
}

function buildUpiUrl(upiId: string, ownerName: string, amount: number, note: string): string {
  const pa = encodeURIComponent(upiId);
  const pn = encodeURIComponent(ownerName);
  const tn = encodeURIComponent(note);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${amount}.00&cu=INR&tn=${tn}`;
}

const AMOUNT_TO_MC: Record<number, number> = {
  149: 14900,
  199: 19900,
  249: 24900,
  299: 29900,
  399: 39900,
  499: 49900,
};

const AMOUNT_TO_CHAR: Record<number, string> = {
  149: "Baek Yoon-Ho",
  199: "Choi Jong-In",
  249: "Cha Hae-In",
  299: "Go Gun-Hee",
  399: "Thomas Andre",
  499: "Sung Jin-Woo",
};

export async function handlePayment(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const upiId = await getUpiId();
  const ownerName = await getOwnerName();

  if (!upiId) {
    await ctx.replyWithHTML(
      `💳 <b>PAYMENT PORTAL</b>\n\n` +
      `⚠️ <b>Payment not configured yet.</b>\n` +
      `Contact the owner to arrange payment.\n\n` +
      `Your Hunter ID: <code>${hunter.telegramId}</code>`,
    );
    return;
  }

  const charList = PREMIUM_CHARACTERS.map((c) =>
    `${c.emoji} <b>${c.name}</b> — ₹${c.priceINR} → ${c.priceManaCoin.toLocaleString()} MC`
  ).join("\n");

  await ctx.replyWithHTML(
    `💳 <b>PAYMENT PORTAL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>💎 Mythic Packages:</b>\n${charList}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>📱 Pay via UPI</b>\n` +
    `UPI ID: <code>${upiId}</code>\n\n` +
    `<b>Steps:</b>\n` +
    `1️⃣ Choose your package below → get QR\n` +
    `2️⃣ Scan QR with GPay / PhonePe / Paytm\n` +
    `   OR copy the UPI ID and pay manually\n` +
    `3️⃣ Tap <b>📨 I've Paid</b> to notify the owner\n` +
    `4️⃣ Owner approves → Mana Coins added instantly!\n` +
    `5️⃣ Use /premium to unlock your character\n\n` +
    `Your ID: <code>${hunter.telegramId}</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💎 ₹149 — Baek Yoon-Ho", callback_data: "qr_149" },
            { text: "💎 ₹199 — Choi Jong-In", callback_data: "qr_199" },
          ],
          [
            { text: "💎 ₹249 — Cha Hae-In", callback_data: "qr_249" },
            { text: "💜 ₹299 — Go Gun-Hee", callback_data: "qr_299" },
          ],
          [
            { text: "💜 ₹399 — Thomas Andre", callback_data: "qr_399" },
            { text: "✨ ₹499 — Sung Jin-Woo", callback_data: "qr_499" },
          ],
          [{ text: "📨 I've Paid — Notify Owner", callback_data: "paid_notify_0_none" }],
          [{ text: "💜 View Premium Characters", callback_data: "action_premium" }],
        ],
      },
    },
  );
}

export async function handleGenerateQr(ctx: Context, amount?: number): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;

  if (!amount) {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    amount = parseInt(text.split(" ")[1] || "0", 10);
  }

  const upiId = await getUpiId();
  const ownerName = await getOwnerName();

  if (!upiId) {
    await ctx.replyWithHTML(
      `⚠️ <b>Payment not configured.</b>\nContact the owner directly.\nYour ID: <code>${hunter.telegramId}</code>`,
    );
    return;
  }

  const validAmounts = [149, 199, 249, 299, 399, 499];
  if (!amount || !validAmounts.includes(amount)) {
    await ctx.replyWithHTML(
      `💳 Choose a package:\n\n` +
      validAmounts.map((a) => `• /qr ${a} — ₹${a} (${AMOUNT_TO_CHAR[a]})`).join("\n"),
    );
    return;
  }

  const charName = AMOUNT_TO_CHAR[amount];
  const mc = AMOUNT_TO_MC[amount];
  const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === amount);
  const note = `SoloLeveling_${charName.replace(/ /g, "_")}`;
  const upiUrl = buildUpiUrl(upiId, ownerName, amount, note);

  const caption =
    `💳 <b>UPI PAYMENT QR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Package: ${char?.emoji ?? "💎"} <b>${charName}</b>\n` +
    `Amount: <b>₹${amount}</b>\n` +
    `Reward: <b>${mc.toLocaleString()} Mana Coins</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 <b>Scan with GPay / PhonePe / Paytm / BHIM</b>\n\n` +
    `<b>Or pay manually:</b>\n` +
    `UPI ID: <code>${upiId}</code>\n` +
    `Amount: <b>₹${amount}</b>\n\n` +
    `Your Hunter ID: <code>${hunter.telegramId}</code>\n` +
    `<i>After paying, tap the button below to notify the owner.</i>`;

  // Encode: telegramId_amount_charName
  const paidCb = `paid_notify_${amount}_${charName.replace(/ /g, "_")}`;

  try {
    const qrBuffer = await qrcode.toBuffer(upiUrl, {
      type: "png",
      width: 512,
      margin: 3,
      color: { dark: "#1a0035", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });

    await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📨 I've Paid — Notify Owner", callback_data: paidCb }],
            [{ text: "⬅️ Back to Payment", callback_data: "action_payment" }],
          ],
        },
      },
    );
  } catch {
    await ctx.replyWithHTML(caption, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📨 I've Paid — Notify Owner", callback_data: paidCb }],
          [{ text: "⬅️ Back to Payment", callback_data: "action_payment" }],
        ],
      },
    });
  }
}

export async function handleQrCallback(ctx: Context, amount: number): Promise<void> {
  await ctx.answerCbQuery();
  await handleGenerateQr(ctx, amount);
}

// Called when player taps "I've Paid"
export async function handlePaidNotify(ctx: Context, amount: number, charNameRaw: string): Promise<void> {
  await ctx.answerCbQuery("✅ Notification sent to owner!", { show_alert: true });
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;

  const charName = charNameRaw.replace(/_/g, " ");
  const mc = AMOUNT_TO_MC[amount] ?? 0;
  const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === amount);

  const amountLine = amount > 0 ? `Amount: <b>₹${amount}</b>\n` : `Amount: <b>Not specified</b>\n`;
  const charLine = charName && charName !== "none" ? `Package: <b>${char?.emoji ?? "💎"} ${charName}</b>\n` : "";
  const mcLine = mc > 0 ? `Mana Coins to add: <b>${mc.toLocaleString()} MC</b>\n` : "";

  // Approve/Reject buttons encode telegramId|amount|charName
  const payload = `${hunter.telegramId}|${amount}|${charNameRaw}`;
  const ownerMsg =
    `💳 <b>PAYMENT CLAIM</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Hunter: <b>${hunter.firstName || hunter.username || "Unknown"}</b>\n` +
    `Username: @${hunter.username || "N/A"}\n` +
    `Telegram ID: <code>${hunter.telegramId}</code>\n` +
    `Rank: <b>${hunter.rank}</b>  Level: <b>${hunter.level}</b>\n\n` +
    amountLine + charLine + mcLine +
    `\n<i>Verify the payment in your UPI app, then approve or reject below.</i>`;

  try {
    if (botInstance) {
      await botInstance.telegram.sendMessage(OWNER_ID, ownerMsg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Approve (+${mc.toLocaleString()} MC)`, callback_data: `pay_approve_${payload}` },
              { text: "❌ Reject", callback_data: `pay_reject_${hunter.telegramId}` },
            ],
          ],
        },
      });
    }
  } catch {
    // silent
  }

  await ctx.replyWithHTML(
    `✅ <b>Owner Notified!</b>\n\n` +
    `Your payment claim has been sent.\n` +
    `Once the owner verifies and approves, your Mana Coins will be added <b>automatically</b>.\n\n` +
    `Hunter ID: <code>${hunter.telegramId}</code>\n` +
    `<i>You'll receive a confirmation message here when approved.</i>`,
  );
}

// Owner taps ✅ Approve
export async function handleApprovePayment(ctx: Context, payload: string): Promise<void> {
  await ctx.answerCbQuery("Processing approval...");
  if (String(ctx.from?.id) !== OWNER_ID) {
    await ctx.answerCbQuery("🚫 Only the owner can approve payments.", { show_alert: true });
    return;
  }

  const parts = payload.split("|");
  const telegramId = parts[0];
  const amount = parseInt(parts[1] ?? "0", 10);
  const charNameRaw = parts[2] ?? "none";
  const charName = charNameRaw.replace(/_/g, " ");
  const mc = AMOUNT_TO_MC[amount] ?? 0;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, telegramId));
  if (!hunter) {
    await ctx.answerCbQuery("⚠️ Hunter not found in database.", { show_alert: true });
    return;
  }

  // Add Mana Coins
  await db.update(huntersTable).set({
    manaCoin: hunter.manaCoin + mc,
    lastSeen: new Date(),
  }).where(eq(huntersTable.id, hunter.id));

  // Edit the owner's message to mark as approved
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.editMessageText(
      (ctx.callbackQuery as any).message?.text +
      `\n\n✅ <b>APPROVED</b> — ${mc.toLocaleString()} MC added to ${hunter.firstName || telegramId}`,
      { parse_mode: "HTML" },
    );
  } catch { /* message edit may fail, that's ok */ }

  // Notify the player
  const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === amount);
  const playerMsg =
    `🎉 <b>PAYMENT APPROVED!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (char ? `Package: ${char.emoji} <b>${charName}</b>\n` : "") +
    `💎 <b>+${mc.toLocaleString()} Mana Coins</b> added to your account!\n\n` +
    `Your new MC balance: <b>${(hunter.manaCoin + mc).toLocaleString()} MC</b>\n\n` +
    `Use /premium to purchase your character now! 🏆`;

  try {
    if (botInstance) {
      await botInstance.telegram.sendMessage(telegramId, playerMsg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "💜 Open Premium Shop", callback_data: "action_premium" },
            { text: "📊 My Profile", callback_data: "action_profile" },
          ]],
        },
      });
    }
  } catch { /* player may have blocked bot */ }

  // Confirm to owner in chat
  await ctx.replyWithHTML(
    `✅ <b>Approved!</b>\n` +
    `+${mc.toLocaleString()} MC credited to <b>${hunter.firstName || telegramId}</b>.\n` +
    `Player has been notified.`,
  );
}

// Owner taps ❌ Reject
export async function handleRejectPayment(ctx: Context, telegramId: string): Promise<void> {
  await ctx.answerCbQuery("Rejected.");
  if (String(ctx.from?.id) !== OWNER_ID) {
    await ctx.answerCbQuery("🚫 Only the owner can reject payments.", { show_alert: true });
    return;
  }

  // Edit owner's message
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch { /* ok */ }

  // Notify the player
  try {
    if (botInstance) {
      await botInstance.telegram.sendMessage(
        telegramId,
        `❌ <b>Payment Not Verified</b>\n\nThe owner could not verify your payment.\n\nIf you believe this is an error, please send your UPI transaction screenshot directly to the owner.\n\nUse /payment to try again.`,
        { parse_mode: "HTML" },
      );
    }
  } catch { /* ok */ }

  await ctx.replyWithHTML(`❌ <b>Payment rejected.</b> Player has been notified.`);
}
