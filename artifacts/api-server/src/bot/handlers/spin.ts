import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { formatCooldown } from "../utils/format";
import { WEAPONS } from "../data/weapons";

const SPIN_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const EXTRA_SPIN_COST = 500;

interface SpinPrize {
  label: string;
  emoji: string;
  rarity: string;
  weight: number;
  apply: (hunter: typeof huntersTable.$inferSelect) => Promise<{ updates: Partial<typeof huntersTable.$inferSelect>; msg: string; dropItem?: string }>;
}

// Weapon drops available from spin (common/rare)
const SPIN_WEAPON_DROPS = ["Iron Sword", "Hunter's Bow", "Steel Blade", "Shadow Dagger", "Rune Spear"];

async function seedWeaponToInventory(hunter: typeof huntersTable.$inferSelect, weaponName: string): Promise<string> {
  const WEAPON = WEAPONS.find((w) => w.name === weaponName);
  if (!WEAPON) return "";
  let [dbItem] = await db.select().from(itemsTable).where(eq(itemsTable.name, weaponName));
  if (!dbItem) {
    [dbItem] = await db.insert(itemsTable).values({
      name: WEAPON.name, type: "weapon", rank: WEAPON.rankRequired,
      description: WEAPON.description, price: WEAPON.price || WEAPON.pricemc * 100,
      hpRestore: 0, mpRestore: 0, strBonus: WEAPON.atkBonus,
      agiBonus: WEAPON.agiBonus, intBonus: WEAPON.intBonus,
      perBonus: 0, maxHpBonus: WEAPON.maxHpBonus, emoji: WEAPON.emoji,
    }).returning();
  }
  const [existing] = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));
  if (existing) {
    await db.update(inventoryTable).set({ quantity: existing.quantity + 1 }).where(eq(inventoryTable.id, existing.id));
  } else {
    await db.insert(inventoryTable).values({ hunterId: hunter.id, itemId: dbItem.id, quantity: 1 });
  }
  return `${WEAPON.emoji} ${WEAPON.name} (+${WEAPON.atkBonus} ATK)`;
}

const SPIN_PRIZES: SpinPrize[] = [
  {
    label: "JACKPOT", emoji: "🎰", rarity: "JACKPOT", weight: 2,
    apply: async (h) => ({ updates: { manaCoin: h.manaCoin + 5000 }, msg: `💎 <b>JACKPOT!</b> You won <b>5,000 Mana Coins!</b>` }),
  },
  {
    label: "Shadow Monarch's Sword", emoji: "👑", rarity: "MYTHIC", weight: 1,
    apply: async (h) => {
      const drop = await seedWeaponToInventory(h, "Shadow Monarch's Sword");
      return {
        updates: { manaCoin: h.manaCoin + 2000, equippedWeapon: "Shadow Monarch's Sword" },
        msg: `👑 <b>MYTHIC DROP!</b> Shadow Monarch's Sword! +2,000 MC!\n${drop}`,
      };
    },
  },
  {
    label: "Mythic Mana", emoji: "💜", rarity: "MYTHIC", weight: 4,
    apply: async (h) => ({
      updates: { manaCoin: h.manaCoin + 1500, gold: h.gold + 30000 },
      msg: `💜 <b>MYTHIC!</b> +1,500 Mana Coins & +30,000 Gold!`,
    }),
  },
  {
    label: "Demon's Edge", emoji: "😈", rarity: "LEGENDARY", weight: 4,
    apply: async (h) => {
      const drop = await seedWeaponToInventory(h, "Demon's Edge");
      return {
        updates: { manaCoin: h.manaCoin + 500, equippedWeapon: "Demon's Edge" },
        msg: `😈 <b>LEGENDARY WEAPON!</b> Demon's Edge! +500 MC!\n${drop}`,
      };
    },
  },
  {
    label: "Legend Haul", emoji: "🌟", rarity: "LEGENDARY", weight: 6,
    apply: async (h) => ({
      updates: { manaCoin: h.manaCoin + 500, gold: h.gold + 50000, dungeonKeys: h.dungeonKeys + 3 },
      msg: `🌟 <b>LEGENDARY!</b> +500 MC, +50,000 Gold, +3 Keys!`,
    }),
  },
  {
    label: "Rune Spear Drop", emoji: "🔱", rarity: "EPIC", weight: 6,
    apply: async (h) => {
      const drop = await seedWeaponToInventory(h, "Rune Spear");
      return {
        updates: { manaCoin: h.manaCoin + 200, gold: h.gold + 10000, equippedWeapon: "Rune Spear" },
        msg: `🔱 <b>EPIC WEAPON!</b> Rune Spear dropped! +200 MC!\n${drop}`,
      };
    },
  },
  {
    label: "Epic Loot", emoji: "🔥", rarity: "EPIC", weight: 12,
    apply: async (h) => ({
      updates: { manaCoin: h.manaCoin + 200, gold: h.gold + 20000, dungeonKeys: h.dungeonKeys + 3 },
      msg: `🔥 <b>EPIC!</b> +200 MC, +20,000 Gold, +3 Keys!`,
    }),
  },
  {
    label: "Shadow Dagger Drop", emoji: "🌑", rarity: "RARE", weight: 8,
    apply: async (h) => {
      const drop = await seedWeaponToInventory(h, "Shadow Dagger");
      return {
        updates: { gold: h.gold + 5000, equippedWeapon: "Shadow Dagger" },
        msg: `🌑 <b>RARE WEAPON!</b> Shadow Dagger dropped!\n${drop}`,
      };
    },
  },
  {
    label: "Rare Find", emoji: "💎", rarity: "RARE", weight: 14,
    apply: async (h) => ({
      updates: { manaCoin: h.manaCoin + 50, gold: h.gold + 5000, dungeonKeys: h.dungeonKeys + 1 },
      msg: `💎 <b>RARE!</b> +50 MC, +5,000 Gold, +1 Key!`,
    }),
  },
  {
    label: "Steel Blade Drop", emoji: "⚔️", rarity: "UNCOMMON", weight: 10,
    apply: async (h) => {
      const drop = await seedWeaponToInventory(h, "Steel Blade");
      return {
        updates: { gold: h.gold + 2000, equippedWeapon: h.equippedWeapon || "Steel Blade" },
        msg: `⚔️ <b>UNCOMMON WEAPON!</b> Steel Blade dropped!\n${drop}`,
      };
    },
  },
  {
    label: "Uncommon", emoji: "🟦", rarity: "UNCOMMON", weight: 18,
    apply: async (h) => ({
      updates: { gold: h.gold + 3000, dungeonKeys: h.dungeonKeys + 1, hp: Math.min(h.maxHp, h.hp + 200) },
      msg: `🟦 <b>UNCOMMON!</b> +3,000 Gold, +1 Key, +200 HP!`,
    }),
  },
  {
    label: "Common", emoji: "⬜", rarity: "COMMON", weight: 25,
    apply: async (h) => ({
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

const SLOT_EMOJIS = ["🎰", "💎", "🌟", "🔥", "👑", "🌑", "⚡", "💜", "🎲", "🏆", "⚔️", "🌑"];
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

  if (isBuySpin) {
    if (hunter.manaCoin < EXTRA_SPIN_COST) {
      await ctx.replyWithHTML(`💎 Extra spin costs <b>${EXTRA_SPIN_COST} Mana Coins</b>.\nYou have: <b>${hunter.manaCoin} MC</b>`);
      return;
    }
    await db.update(huntersTable).set({ manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }).where(eq(huntersTable.id, hunter.id));
    await doSpin(ctx, { ...hunter, manaCoin: hunter.manaCoin - EXTRA_SPIN_COST }, true);
    return;
  }

  if (hunter.lastSpin) {
    const elapsed = Date.now() - hunter.lastSpin.getTime();
    if (elapsed < SPIN_COOLDOWN_MS) {
      const remaining = SPIN_COOLDOWN_MS - elapsed;
      await ctx.replyWithHTML(
        `🎰 <b>SHADOW LOTTERY</b>\n\nNext free spin: <b>${formatCooldown(remaining)}</b>\n\n` +
        `💎 Buy extra spin for <b>${EXTRA_SPIN_COST} MC</b>!\n<i>Weapons, mana coins & gold await!</i>`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: `💎 Extra Spin (${EXTRA_SPIN_COST} MC)`, callback_data: "spin_buy" }]],
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

  await ctx.replyWithHTML(
    `🎰 <b>SHADOW LOTTERY</b> 🎰\n\n[ ${randomSlots()} ]\n\n⏳ <i>Spinning...</i>`,
  );

  await new Promise((r) => setTimeout(r, 900));

  const prizeResult = await prize.apply(hunter);
  const finalUpdates = {
    ...prizeResult.updates,
    lastSpin: isPaid ? hunter.lastSpin : new Date(),
    lastSeen: new Date(),
  };

  await db.update(huntersTable).set(finalUpdates).where(eq(huntersTable.id, hunter.id));

  const finalMsg =
    `🎰 <b>SHADOW LOTTERY RESULT</b>\n\n` +
    `[ ${prize.emoji} | ${prize.emoji} | ${prize.emoji} ]\n\n` +
    `🏆 Rarity: <b>${prize.rarity}</b>\n\n` +
    prizeResult.msg +
    (isPaid ? `\n\n<i>💎 Paid Spin (${EXTRA_SPIN_COST} MC used)</i>` : `\n\n<i>Next free spin in 6 hours</i>`);

  await ctx.replyWithHTML(finalMsg, {
    reply_markup: {
      inline_keyboard: [[
        { text: "🎰 Spin Again (Buy)", callback_data: "spin_buy" },
        { text: "🗡️ My Weapons", callback_data: "action_equip" },
      ], [
        { text: "📊 Profile", callback_data: "action_profile" },
      ]],
    },
  });
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
