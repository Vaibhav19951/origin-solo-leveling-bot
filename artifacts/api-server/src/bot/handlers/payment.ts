import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PREMIUM_CHARACTERS } from "../data/premium";
import qrcode from "qrcode";

const DEFAULT_UPI_ID = process.env["OWNER_UPI_ID"] || "your_upi@upi";
const MERCHANT_NAME = "SoloLevelingRPG";

function getUpiId(): string {
  return process.env["OWNER_UPI_ID"] || DEFAULT_UPI_ID;
}

function buildUpiUrl(amount: number, note: string): string {
  const upiId = getUpiId();
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

async function generateQrBuffer(data: string): Promise<Buffer> {
  return qrcode.toBuffer(data, { type: "png", width: 400, margin: 2, color: { dark: "#1a0035", light: "#ffffff" } });
}

export async function handlePayment(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const charList = PREMIUM_CHARACTERS.map((c) =>
    `• ${c.emoji} <b>${c.name}</b> — ₹${c.priceINR} → ${c.priceManaCoin.toLocaleString()} MC`
  ).join("\n");

  const upiId = getUpiId();

  await ctx.replyWithHTML(
    `💳 <b>PAYMENT PORTAL</b>\n` +
    `<i>Unlock Mythic Characters with real payment</i>\n\n` +
    `━━━━━ PACKAGES ━━━━━\n` +
    charList +
    `\n\n━━━━━ HOW TO PAY ━━━━━\n` +
    `1️⃣ Use /qr [amount] to get a UPI QR code\n` +
    `2️⃣ Pay via any UPI app (GPay, PhonePe, Paytm)\n` +
    `3️⃣ After payment, the owner will add Mana Coins to your account\n` +
    `4️⃣ Use /premium to purchase the character\n\n` +
    `📞 <b>Contact after payment:</b> @${upiId.split("@")[0] || "owner"}\n\n` +
    `Your ID: <code>${hunter.telegramId}</code>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 Generate ₹149 QR (Baek Yoon-Ho)", callback_data: "qr_149" }],
          [{ text: "💎 Generate ₹199 QR (Choi Jong-In)", callback_data: "qr_199" }],
          [{ text: "💎 Generate ₹249 QR (Cha Hae-In)", callback_data: "qr_249" }],
          [{ text: "💜 Generate ₹299 QR (Go Gun-Hee)", callback_data: "qr_299" }],
          [{ text: "💜 Generate ₹399 QR (Thomas Andre)", callback_data: "qr_399" }],
          [{ text: "✨ Generate ₹499 QR (Sung Jin-Woo)", callback_data: "qr_499" }],
          [{ text: "💎 View Premium Shop", callback_data: "action_premium" }],
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

  // Parse amount from text if not provided
  if (!amount) {
    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    amount = parseInt(text.split(" ")[1] || "0", 10);
  }

  const validAmounts = [149, 199, 249, 299, 399, 499];
  if (!amount || !validAmounts.includes(amount)) {
    await ctx.replyWithHTML(
      `💳 <b>GENERATE PAYMENT QR</b>\n\nValid amounts:\n` +
      validAmounts.map((a) => {
        const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === a);
        return `• /qr ${a} — ₹${a} (${char?.name || "Package"})`;
      }).join("\n") +
      `\n\nExample: <code>/qr 499</code>`,
    );
    return;
  }

  const char = PREMIUM_CHARACTERS.find((c) => c.priceINR === amount);
  const note = char ? `SoloLeveling_${char.name.replace(/ /g, "_")}` : `SoloLeveling_${amount}INR`;
  const upiUrl = buildUpiUrl(amount, note);
  const upiId = getUpiId();

  try {
    const qrBuffer = await generateQrBuffer(upiUrl);
    const caption =
      `💳 <b>UPI PAYMENT QR</b>\n\n` +
      `Amount: <b>₹${amount}</b>\n` +
      (char ? `Package: ${char.emoji} <b>${char.name}</b> (${char.priceManaCoin.toLocaleString()} MC)\n` : "") +
      `UPI ID: <code>${upiId}</code>\n\n` +
      `📱 Scan with GPay, PhonePe, or Paytm\n\n` +
      `After payment, send your transaction ID to the owner\nYour Hunter ID: <code>${hunter.telegramId}</code>`;

    await ctx.replyWithPhoto(
      { source: qrBuffer },
      { caption, parse_mode: "HTML" },
    );
  } catch {
    await ctx.replyWithHTML(
      `💳 <b>UPI PAYMENT</b>\n\nAmount: <b>₹${amount}</b>\n` +
      `UPI ID: <code>${upiId}</code>\n\n` +
      `Pay manually using any UPI app.\nYour Hunter ID: <code>${hunter.telegramId}</code>`,
    );
  }
}

export async function handleQrCallback(ctx: Context, amount: number): Promise<void> {
  await ctx.answerCbQuery();
  await handleGenerateQr(ctx, amount);
}
