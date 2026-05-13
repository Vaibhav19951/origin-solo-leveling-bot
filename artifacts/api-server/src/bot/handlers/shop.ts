import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { SHOP_ITEMS, getShopItems } from "../data/items";

export async function handleShop(ctx: Context): Promise<void> {
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

  const available = getShopItems(hunter.rank);
  const potions = available.filter((i) => i.type === "potion");
  const weapons = available.filter((i) => i.type === "weapon");
  const armors = available.filter((i) => i.type === "armor");

  const formatSection = (title: string, items: typeof available) => {
    if (items.length === 0) return "";
    const lines = items.map(
      (i) =>
        `  ${i.emoji} <b>${i.name}</b> — <b>${i.price}g</b>\n` +
        `      <i>${i.description}</i>`,
    );
    return `\n<b>${title}</b>\n${lines.join("\n")}`;
  };

  const msg =
    `🏪 <b>HUNTER ASSOCIATION SHOP</b>\n` +
    `💰 Your Gold: <b>${hunter.gold.toLocaleString()}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━` +
    formatSection("🧪 Consumables", potions) +
    formatSection("⚔️ Weapons", weapons) +
    formatSection("🛡️ Armor", armors) +
    `\n\n` +
    `Use: /buy [item name]\nExample: /buy Small HP Potion`;

  await ctx.replyWithHTML(msg);
}

export async function handleBuy(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const itemName = text.split(" ").slice(1).join(" ").trim();

  if (!itemName) {
    await ctx.replyWithHTML(`Usage: /buy [item name]\nExample: /buy Small HP Potion`);
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

  const shopItem = SHOP_ITEMS.find(
    (i) => i.name.toLowerCase() === itemName.toLowerCase(),
  );

  if (!shopItem) {
    await ctx.replyWithHTML(`⚠️ Item "<b>${itemName}</b>" not found in shop.\nUse /shop to browse available items.`);
    return;
  }

  const available = getShopItems(hunter.rank);
  if (!available.find((i) => i.name === shopItem.name)) {
    await ctx.replyWithHTML(`⚠️ Your rank is too low to purchase <b>${shopItem.name}</b>.`);
    return;
  }

  if (hunter.gold < shopItem.price) {
    await ctx.replyWithHTML(
      `💰 Insufficient gold!\n` +
        `Required: <b>${shopItem.price}g</b>  |  You have: <b>${hunter.gold}g</b>`,
    );
    return;
  }

  // Find or create item in DB
  let [dbItem] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.name, shopItem.name));

  if (!dbItem) {
    [dbItem] = await db
      .insert(itemsTable)
      .values({
        name: shopItem.name,
        type: shopItem.type,
        rank: shopItem.rank,
        description: shopItem.description,
        price: shopItem.price,
        hpRestore: shopItem.hpRestore,
        mpRestore: shopItem.mpRestore,
        strBonus: shopItem.strBonus,
        agiBonus: shopItem.agiBonus,
        intBonus: shopItem.intBonus,
        perBonus: shopItem.perBonus,
        maxHpBonus: shopItem.maxHpBonus,
        emoji: shopItem.emoji,
      })
      .returning();
  }

  // Handle dungeon key specially
  if (shopItem.name === "Dungeon Key") {
    await db
      .update(huntersTable)
      .set({ gold: hunter.gold - shopItem.price, dungeonKeys: hunter.dungeonKeys + 1 })
      .where(eq(huntersTable.id, hunter.id));
    await ctx.replyWithHTML(
      `✅ Purchased ${shopItem.emoji} <b>${shopItem.name}</b> for <b>${shopItem.price}g</b>!\n` +
        `🔑 Dungeon Keys: <b>${hunter.dungeonKeys + 1}</b>\n` +
        `💰 Gold remaining: <b>${hunter.gold - shopItem.price}g</b>`,
    );
    return;
  }

  // Add to inventory
  const [existing] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, dbItem.id)));

  if (existing) {
    await db
      .update(inventoryTable)
      .set({ quantity: existing.quantity + 1 })
      .where(eq(inventoryTable.id, existing.id));
  } else {
    await db.insert(inventoryTable).values({
      hunterId: hunter.id,
      itemId: dbItem.id,
      quantity: 1,
    });
  }

  await db
    .update(huntersTable)
    .set({ gold: hunter.gold - shopItem.price })
    .where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `✅ Purchased ${shopItem.emoji} <b>${shopItem.name}</b> for <b>${shopItem.price}g</b>!\n` +
      `💰 Gold remaining: <b>${hunter.gold - shopItem.price}g</b>`,
  );
}

export async function handleSell(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const itemName = text.split(" ").slice(1).join(" ").trim();

  if (!itemName) {
    await ctx.replyWithHTML(`Usage: /sell [item name]\nExample: /sell Small HP Potion`);
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

  const [item] = await db
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.name, itemName));

  if (!item) {
    await ctx.replyWithHTML(`⚠️ Item not found. Check /inventory for item names.`);
    return;
  }

  const [invRow] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.hunterId, hunter.id), eq(inventoryTable.itemId, item.id)));

  if (!invRow || invRow.quantity <= 0) {
    await ctx.replyWithHTML(`⚠️ You don't have <b>${item.name}</b> in your inventory.`);
    return;
  }

  const sellPrice = Math.floor(item.price * 0.5);

  await db
    .update(huntersTable)
    .set({ gold: hunter.gold + sellPrice })
    .where(eq(huntersTable.id, hunter.id));

  if (invRow.quantity <= 1) {
    await db.delete(inventoryTable).where(eq(inventoryTable.id, invRow.id));
  } else {
    await db
      .update(inventoryTable)
      .set({ quantity: invRow.quantity - 1 })
      .where(eq(inventoryTable.id, invRow.id));
  }

  await ctx.replyWithHTML(
    `💰 Sold ${item.emoji} <b>${item.name}</b> for <b>${sellPrice}g</b>!\n` +
      `Gold: <b>${hunter.gold + sellPrice}g</b>`,
  );
}
