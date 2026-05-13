import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { PREMIUM_CHARACTERS, RARITY_EMOJI } from "../data/premium";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handlePremium(ctx: Context): Promise<void> {
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

  const charList = PREMIUM_CHARACTERS.map((c) => {
    const rarityEmoji = RARITY_EMOJI[c.rarity] || "🌟";
    const owned = hunter.premiumCharacter === c.id;
    return (
      `${rarityEmoji} <b>${c.name}</b> — <i>${c.title}</i>\n` +
      `   Rarity: <b>${c.rarity}</b> | Rank: <b>${c.rank}</b>\n` +
      `   💎 <b>${c.priceManaCoin.toLocaleString()} MC</b> (~₹${c.priceINR})\n` +
      `   ${c.specialAbility}\n` +
      (owned ? `   ✅ <b>OWNED</b>` : `   /buy_premium ${c.id}`)
    );
  }).join("\n\n");

  const msg =
    `💎 <b>MYTHIC CHARACTER SHOP</b> 💎\n` +
    `<i>Unlock legendary hunters from the Solo Leveling universe!</i>\n\n` +
    `💎 Your Mana Coins: <b>${hunter.manaCoin.toLocaleString()} MC</b>\n` +
    `${hunter.premiumCharacter ? `👤 Active Character: <b>${PREMIUM_CHARACTERS.find(c => c.id === hunter.premiumCharacter)?.name || hunter.premiumCharacter}</b>` : `👤 No character equipped`}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    charList +
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>How to earn Mana Coins (MC):</b>\n` +
    `• 🏆 Win PvP battles\n` +
    `• 🏰 Clear S-rank dungeons\n` +
    `• 📅 Daily login streak bonus\n` +
    `• 💱 Trade with other hunters\n\n` +
    `Purchase: /buy_premium [character_id]`;

  const charButtons = PREMIUM_CHARACTERS.map((c) => {
    const owned = hunter.premiumCharacter === c.id;
    const rarityEmoji = RARITY_EMOJI[c.rarity] || "🌟";
    return {
      text: owned ? `✅ ${c.name}` : `${rarityEmoji} ${c.name} — ₹${c.priceINR}`,
      callback_data: owned ? `premium_view_${c.id}` : `premium_buy_${c.id}`,
    };
  });

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < charButtons.length; i += 2) {
    rows.push(charButtons.slice(i, i + 2));
  }

  await ctx.replyWithHTML(msg, { reply_markup: { inline_keyboard: rows } });
}

export async function handleBuyPremium(ctx: Context, characterIdArg?: string): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const charId = characterIdArg || text.split(" ").slice(1).join(" ").trim().toLowerCase().replace(/ /g, "_");

  if (!charId) {
    await ctx.replyWithHTML(`Usage: /buy_premium [character_id]\nUse /premium to see all characters.`);
    return;
  }

  const character = PREMIUM_CHARACTERS.find(
    (c) => c.id === charId || c.name.toLowerCase().replace(/ /g, "_") === charId,
  );

  if (!character) {
    await ctx.replyWithHTML(`⚠️ Character not found. Use /premium to see all available characters.`);
    return;
  }

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  if (hunter.premiumCharacter === character.id) {
    await ctx.replyWithHTML(
      `✅ You already own <b>${character.name}</b>!\n\n${character.specialAbility}`,
    );
    return;
  }

  if (hunter.manaCoin < character.priceManaCoin) {
    const needed = character.priceManaCoin - hunter.manaCoin;
    await ctx.replyWithHTML(
      `💎 <b>Insufficient Mana Coins</b>\n\n` +
        `Character: <b>${character.name}</b>\n` +
        `Cost: <b>${character.priceManaCoin.toLocaleString()} MC</b>\n` +
        `You have: <b>${hunter.manaCoin.toLocaleString()} MC</b>\n` +
        `Still need: <b>${needed.toLocaleString()} MC</b>\n\n` +
        `Earn Mana Coins by winning PvP battles and clearing dungeons!`,
    );
    return;
  }

  // Apply purchase
  await db
    .update(huntersTable)
    .set({
      manaCoin: hunter.manaCoin - character.priceManaCoin,
      premiumCharacter: character.id,
      // Apply stat bonuses
      strength: hunter.strength + character.strBonus,
      agility: hunter.agility + character.agiBonus,
      intelligence: hunter.intelligence + character.intBonus,
      perception: hunter.perception + character.perBonus,
      maxHp: hunter.maxHp + character.maxHpBonus,
      hp: Math.min(hunter.hp + character.maxHpBonus, hunter.maxHp + character.maxHpBonus),
      lastSeen: new Date(),
    })
    .where(eq(huntersTable.id, hunter.id));

  const rarityEmoji = RARITY_EMOJI[character.rarity] || "🌟";

  const successMsg =
    `${rarityEmoji} <b>MYTHIC CHARACTER UNLOCKED!</b> ${rarityEmoji}\n\n` +
    `${character.emoji} <b>${character.name}</b>\n` +
    `<i>${character.title}</i>\n\n` +
    `━━━━━ STAT BONUSES APPLIED ━━━━━\n` +
    `⚔️ STR: +${character.strBonus}\n` +
    `🏃 AGI: +${character.agiBonus}\n` +
    `🔮 INT: +${character.intBonus}\n` +
    `👁️ PER: +${character.perBonus}\n` +
    `❤️ Max HP: +${character.maxHpBonus}\n\n` +
    `✨ XP Multiplier: <b>${character.xpMultiplier}x</b>\n` +
    `💰 Gold Multiplier: <b>${character.goldMultiplier}x</b>\n\n` +
    `${character.specialAbility}\n\n` +
    `💎 Mana Coins remaining: <b>${(hunter.manaCoin - character.priceManaCoin).toLocaleString()}</b>`;

  try {
    await ctx.replyWithPhoto(
      { url: character.imageUrl },
      { caption: successMsg, parse_mode: "HTML" },
    );
  } catch {
    await ctx.replyWithHTML(successMsg);
  }
}

export async function handlePremiumView(ctx: Context, characterId: string): Promise<void> {
  await ctx.answerCbQuery();
  const character = PREMIUM_CHARACTERS.find((c) => c.id === characterId);
  if (!character) return;
  const rarityEmoji = RARITY_EMOJI[character.rarity] || "🌟";
  await ctx.replyWithHTML(
    `${rarityEmoji} <b>${character.name}</b> — <i>${character.title}</i>\n\n` +
    `<b>Rarity:</b> ${character.rarity}\n` +
    `<b>Special:</b> ${character.specialAbility}\n\n` +
    `<i>${character.description}</i>`,
  );
}

export async function handlePremiumBuyCallback(ctx: Context, characterId: string): Promise<void> {
  await ctx.answerCbQuery();
  await handleBuyPremium(ctx, characterId);
}
