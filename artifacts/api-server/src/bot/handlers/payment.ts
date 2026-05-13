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
      `The owner hasn't set up a UPI ID. Please contact the owner to arrange payment.\n\n` +
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
    `4️⃣ Owner adds your Mana Coins within hours\n` +
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
          [{ text: "📨 I've Paid — Notify Owner", callback_data: "paid_notify" }],
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
      `⚠️ <b>Payment not configured.</b>\nThe owner hasn't set a UPI ID yet.\nContact them directly to arrange payment.\n\nYour ID: <code>${hunter.telegramId}</code>`,
    );
    return;
  }

  const validAmounts = [149, 199, 249, 299, 399, 499];
  if (!amount || !validAmounts.includes(amount)) {
    await ctx.replyWithHTML(
      `💳 Choose a package amount:\n\n` +
      validAmounts.map((a) => {
        const char = AMOUNT_TO_CHAR[a];
        return `• /qr ${a} — ₹${a} (${char || "Package"})`;
      }).join("\n"),
    );
    return;
  }

  const charName = AMOUNT_TO_CHAR[amount] || "Package";
  const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === amount);
  const note = `SoloLeveling_${charName.replace(/ /g, "_")}`;
  const upiUrl = buildUpiUrl(upiId, ownerName, amount, note);

  const caption =
    `💳 <b>UPI PAYMENT QR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Package: ${char?.emoji ?? "💎"} <b>${charName}</b>\n` +
    `Amount: <b>₹${amount}</b>\n` +
    (char ? `Reward: <b>${char.priceManaCoin.toLocaleString()} Mana Coins</b>\n` : "") +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 <b>Scan this QR</b> with:\n` +
    `• Google Pay  • PhonePe  • Paytm\n` +
    `• BHIM  • Any UPI App\n\n` +
    `<b>Or pay manually:</b>\n` +
    `UPI ID: <code>${upiId}</code>\n` +
    `Amount: <b>₹${amount}</b>\n\n` +
    `Your Hunter ID: <code>${hunter.telegramId}</code>\n` +
    `<i>After paying, tap I've Paid to notify owner</i>`;

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
            [{ text: "📨 I've Paid — Notify Owner", callback_data: `paid_confirm_${amount}_${charName.replace(/ /g, "_")}` }],
            [{ text: "⬅️ Back to Payment", callback_data: "action_payment" }],
          ],
        },
      },
    );
  } catch {
    // Fallback: show UPI details as text if QR generation fails
    await ctx.replyWithHTML(
      caption,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📨 I've Paid — Notify Owner", callback_data: `paid_confirm_${amount}_${charName.replace(/ /g, "_")}` }],
            [{ text: "⬅️ Back to Payment", callback_data: "action_payment" }],
          ],
        },
      },
    );
  }
}

export async function handleQrCallback(ctx: Context, amount: number): Promise<void> {
  await ctx.answerCbQuery();
  await handleGenerateQr(ctx, amount);
}

export async function handlePaidNotify(ctx: Context, amount?: number, charName?: string): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;

  const amountLine = amount ? `Amount: <b>₹${amount}</b>\n` : "";
  const charLine = charName ? `Package: <b>${charName.replace(/_/g, " ")}</b>\n` : "";

  const ownerMsg =
    `💳 <b>PAYMENT CLAIM</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Hunter: <b>${hunter.firstName || hunter.username || "Unknown"}</b>\n` +
    `Username: @${hunter.username || "N/A"}\n` +
    `Telegram ID: <code>${hunter.telegramId}</code>\n` +
    amountLine + charLine +
    `Rank: <b>${hunter.rank}</b>  Level: <b>${hunter.level}</b>\n\n` +
    `<i>Player claims they've paid. Verify and use /addmana to add coins.</i>`;

  try {
    if (botInstance) {
      await botInstance.telegram.sendMessage(OWNER_ID, ownerMsg, { parse_mode: "HTML" });
    }
  } catch {
    // Owner notification failed silently
  }

  await ctx.replyWithHTML(
    `✅ <b>Payment Notification Sent!</b>\n\n` +
    `The owner has been notified of your payment.\n\n` +
    `Your Hunter ID: <code>${hunter.telegramId}</code>\n` +
    `<i>Mana Coins will be added once payment is verified.</i>`,
  );
}
