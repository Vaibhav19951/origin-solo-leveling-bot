import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { WEAPONS, getWeaponByName, WEAPON_RARITY_EMOJIS } from "../data/weapons";
import { RANK_EMOJIS } from "../utils/ranks";

const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

async function seedWeaponItem(weapon: ReturnType<typeof getWeaponByName>) {
  if (!weapon) return null;
  const [existing] = await db.select().from(itemsTable).where(eq(itemsTable.name, weapon.name));
  if (existing) return existing;
  const [seeded] = await db.insert(itemsTable).values({
    name: weapon.name,
    type: "weapon",
    rank: weapon.rankRequired,
    description: weapon.description,
    price: weapon.price || weapon.pricemc * 100,
    hpRestore: 0, mpRestore: 0,
    strBonus: weapon.atkBonus,
    agiBonus: weapon.agiBonus,
    intBonus: weapon.intBonus,
    perBonus: 0,
    maxHpBonus: weapon.maxHpBonus,
    emoji: weapon.emoji,
  }).returning();
  return seeded;
}

export async function handleEquip(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const weaponQuery = text.split(" ").slice(1).join(" ").trim().toLowerCase();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!weaponQuery) {
    // Show equipped weapon and inventory weapons
    const invItems = await db.select({ inv: inventoryTable, item: itemsTable })
      .from(inventoryTable)
      .innerJoin(itemsTable, eq(inventoryTable.itemId, itemsTable.id))
      .where(and(eq(inventoryTable.hunterId, hunter.id), eq(itemsTable.type, "weapon")));

    const weaponLine = hunter.equippedWeapon
      ? `⚔️ Equipped: <b>${hunter.equippedWeapon}</b>`
      : `⚔️ No weapon equipped`;

    if (invItems.length === 0) {
      await ctx.replyWithHTML(
        `🗡️ <b>WEAPONS</b>\n${weaponLine}\n\nYou have no weapons in your inventory.\n\n` +
        `Buy weapons from /shop or earn them from /spin!\nView all weapons: /weaponshop`,
      );
      return;
    }

    const list = invItems.map((r) => {
      const w = WEAPONS.find((x) => x.name === r.item.name);
      const rarity = WEAPON_RARITY_EMOJIS[w?.rarity || "common"];
      const active = hunter.equippedWeapon === r.item.name ? " ✅" : "";
      return `${r.item.emoji} ${rarity} <b>${r.item.name}</b>${active}\n  +${r.item.strBonus} ATK${r.item.agiBonus ? ` +${r.item.agiBonus} AGI` : ""}${w?.special ? ` | ${w.special}` : ""}`;
    }).join("\n\n");

    await ctx.replyWithHTML(
      `🗡️ <b>YOUR WEAPONS</b>\n${weaponLine}\n━━━━━━━━━━━━━━━━━━━━━━━\n\n${list}\n\n` +
      `Equip: /equip [weapon name]`,
    );
    return;
  }

  // Equip a specific weapon
  const weapon = WEAPONS.find((w) => w.name.toLowerCase().includes(weaponQuery));
  if (!weapon) {
    await ctx.replyWithHTML(`⚠️ Weapon not found. Use /equip to see your weapons or /weaponshop to browse.`);
    return;
  }

  // Check inventory
  const dbItem = await seedWeaponItem(weapon);
  if (!dbItem) { await ctx.replyWithHTML(`⚠️ Item error.`); return; }

  const [invEntry] = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));

  if (!invEntry) {
    await ctx.replyWithHTML(
      `⚠️ You don't own <b>${weapon.name}</b>.\n\n` +
      (weapon.price > 0 ? `Buy from /shop for ${weapon.price}g\n` : "") +
      (weapon.pricemc > 0 ? `Buy from /weaponshop for ${weapon.pricemc} MC` : ""),
    );
    return;
  }

  await db.update(huntersTable).set({ equippedWeapon: weapon.name }).where(eq(huntersTable.id, hunter.id));

  const r = WEAPON_RARITY_EMOJIS[weapon.rarity];
  await ctx.replyWithHTML(
    `${weapon.emoji} <b>WEAPON EQUIPPED!</b>\n\n${r} <b>${weapon.name}</b>\n` +
    `<i>${weapon.description}</i>\n\n` +
    `⚔️ ATK: <b>+${weapon.atkBonus}</b>` +
    (weapon.agiBonus ? `  🌀 AGI: <b>+${weapon.agiBonus}</b>` : "") +
    (weapon.intBonus ? `  🧠 INT: <b>+${weapon.intBonus}</b>` : "") +
    (weapon.maxHpBonus ? `  ❤️ HP: <b>+${weapon.maxHpBonus}</b>` : "") +
    (weapon.special ? `\n✨ Special: <b>${weapon.special}</b>` : "") +
    `\n\nYour weapon will now appear in combat!`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "⚔️ Hunt Now", callback_data: "action_hunt" },
          { text: "🗡️ My Weapons", callback_data: "action_equip" },
        ]],
      },
    },
  );
}

export async function handleWeaponShop(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  const hunterRankIdx = RANK_ORDER.indexOf(hunter.rank === "NLH" ? "NLH" : hunter.rank);

  // MC weapons
  const premiumWeapons = WEAPONS.filter((w) => w.pricemc > 0);
  const shopWeapons = WEAPONS.filter((w) => w.price > 0);

  const mcLines = premiumWeapons.map((w) => {
    const rIdx = RANK_ORDER.indexOf(w.rankRequired);
    const locked = rIdx > hunterRankIdx ? " 🔒" : "";
    const r = WEAPON_RARITY_EMOJIS[w.rarity];
    return `${w.emoji} ${r} <b>${w.name}</b>${locked}\n` +
      `  ⚔️+${w.atkBonus}${w.agiBonus ? ` 🌀+${w.agiBonus}` : ""}${w.special ? ` | ${w.special}` : ""}\n` +
      `  💎 <b>${w.pricemc} MC</b> | Rank ${w.rankRequired}\n  <code>/buyweapon ${w.name}</code>`;
  }).join("\n\n");

  const shopLines = shopWeapons.map((w) => {
    const r = WEAPON_RARITY_EMOJIS[w.rarity];
    return `${w.emoji} ${r} <b>${w.name}</b> — ⚔️+${w.atkBonus}${w.special ? ` | ${w.special}` : ""}\n  💰 ${w.price}g | /buy ${w.name}`;
  }).join("\n");

  await ctx.replyWithHTML(
    `🗡️ <b>WEAPON SHOP</b>\n` +
    `💎 MC: <b>${hunter.manaCoin}</b>  |  💰 Gold: <b>${hunter.gold.toLocaleString()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>💎 Premium Weapons (Mana Coins):</b>\n${mcLines}\n\n` +
    `<b>💰 Gold Weapons (in /shop):</b>\n${shopLines}\n\n` +
    `<i>Weapons drop from /spin and /dungeon too!</i>`,
  );
}

export async function handleBuyWeapon(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const weaponQuery = text.split(" ").slice(1).join(" ").trim().toLowerCase();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!weaponQuery) { await ctx.replyWithHTML(`Usage: /buyweapon [name]\nBrowse: /weaponshop`); return; }

  const weapon = WEAPONS.find((w) => w.name.toLowerCase().includes(weaponQuery) && w.pricemc > 0);
  if (!weapon) {
    await ctx.replyWithHTML(`⚠️ Premium weapon not found.\n\nFor gold weapons, use /buy [name] in the /shop.\nFor MC weapons: /weaponshop`);
    return;
  }

  const hunterRankIdx = RANK_ORDER.indexOf(hunter.rank === "NLH" ? "NLH" : hunter.rank);
  const weaponRankIdx = RANK_ORDER.indexOf(weapon.rankRequired);
  if (weaponRankIdx > hunterRankIdx) {
    await ctx.replyWithHTML(`🔒 <b>${weapon.name}</b> requires Rank <b>${weapon.rankRequired}</b>. Your rank: <b>${hunter.rank}</b>`);
    return;
  }

  if (hunter.manaCoin < weapon.pricemc) {
    await ctx.replyWithHTML(`💎 Insufficient Mana Coins!\nCost: <b>${weapon.pricemc} MC</b> | You have: <b>${hunter.manaCoin} MC</b>`);
    return;
  }

  const dbItem = await seedWeaponItem(weapon);
  if (!dbItem) { await ctx.replyWithHTML(`⚠️ Item error.`); return; }

  const [existing] = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));

  if (existing) { await ctx.replyWithHTML(`✅ You already own <b>${weapon.name}</b>!\nEquip it: /equip ${weapon.name}`); return; }

  await db.update(huntersTable).set({
    manaCoin: hunter.manaCoin - weapon.pricemc,
    equippedWeapon: weapon.name,
  }).where(eq(huntersTable.id, hunter.id));

  await db.insert(inventoryTable).values({ hunterId: hunter.id, itemId: dbItem.id, quantity: 1 });

  const r = WEAPON_RARITY_EMOJIS[weapon.rarity];
  await ctx.replyWithHTML(
    `${weapon.emoji} <b>WEAPON ACQUIRED!</b>\n\n${r} <b>${weapon.name}</b>\n<i>${weapon.description}</i>\n\n` +
    `⚔️ ATK: <b>+${weapon.atkBonus}</b>` +
    (weapon.special ? `\n✨ Special: <b>${weapon.special}</b>` : "") +
    `\n💎 Cost: <b>${weapon.pricemc} MC</b> | Remaining: <b>${hunter.manaCoin - weapon.pricemc} MC</b>\n\n` +
    `Weapon auto-equipped! Use /hunt to unleash it.`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "⚔️ Hunt Now", callback_data: "action_hunt" },
          { text: "🗡️ Weapon Shop", callback_data: "action_weaponshop" },
        ]],
      },
    },
  );
}

export async function handleUnequip(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;
  if (!hunter.equippedWeapon) { await ctx.replyWithHTML(`⚠️ No weapon equipped.`); return; }
  await db.update(huntersTable).set({ equippedWeapon: null }).where(eq(huntersTable.id, hunter.id));
  await ctx.replyWithHTML(`✅ Weapon unequipped. Fighting bare-handed now.`);
}
