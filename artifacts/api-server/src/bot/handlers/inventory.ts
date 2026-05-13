import type { Context } from "telegraf";
import { db, huntersTable, inventoryTable, itemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function handleInventory(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ <b>[ SYSTEM ]</b>\nRegister first with /start`);
    return;
  }

  const invRows = await db
    .select({
      quantity: inventoryTable.quantity,
      itemId: inventoryTable.itemId,
      invId: inventoryTable.id,
    })
    .from(inventoryTable)
    .where(eq(inventoryTable.hunterId, hunter.id));

  if (invRows.length === 0) {
    await ctx.replyWithHTML(
      `🎒 <b>INVENTORY</b>\n\n` +
        `Your inventory is empty.\n\n` +
        `Items can be:\n• Dropped from monsters during /hunt\n• Purchased from /shop`,
    );
    return;
  }

  const itemIds = invRows.map((r) => r.itemId);
  const items = await Promise.all(
    itemIds.map((id) => db.select().from(itemsTable).where(eq(itemsTable.id, id))),
  );

  const itemMap = new Map(items.flat().map((item) => [item.id, item]));

  const potions = invRows.filter((r) => {
    const item = itemMap.get(r.itemId);
    return item?.type === "potion";
  });
  const weapons = invRows.filter((r) => {
    const item = itemMap.get(r.itemId);
    return item?.type === "weapon";
  });
  const armors = invRows.filter((r) => {
    const item = itemMap.get(r.itemId);
    return item?.type === "armor";
  });

  const formatSection = (title: string, rows: typeof invRows) => {
    if (rows.length === 0) return "";
    const lines = rows
      .map((r) => {
        const item = itemMap.get(r.itemId);
        if (!item) return "";
        return `  ${item.emoji} <b>${item.name}</b> x${r.quantity}`;
      })
      .filter(Boolean);
    return `\n<b>${title}</b>\n${lines.join("\n")}`;
  };

  const potionsSection = formatSection("🧪 Potions", potions);
  const weaponsSection = formatSection("⚔️ Weapons", weapons);
  const armorsSection = formatSection("🛡️ Armor", armors);

  const msg =
    `🎒 <b>INVENTORY</b>\n` +
    `Hunter: <b>${hunter.firstName || hunter.username}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━` +
    potionsSection +
    weaponsSection +
    armorsSection +
    `\n\n` +
    `Use /use [item name] to use a potion.\nUse /sell [item name] to sell items.`;

  await ctx.replyWithHTML(msg);
}

export async function handleUseItem(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const itemName = text.split(" ").slice(1).join(" ").trim();

  if (!itemName) {
    await ctx.replyWithHTML(`Usage: /use [item name]\nExample: /use Small HP Potion`);
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
    await ctx.replyWithHTML(`⚠️ Item "<b>${itemName}</b>" not found.\nCheck /inventory for your items.`);
    return;
  }

  if (item.type !== "potion" && item.name !== "Dungeon Key") {
    await ctx.replyWithHTML(`⚠️ <b>${item.name}</b> cannot be used directly.\nWeapons and armor are equipped automatically.`);
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

  // Apply effect
  let newHp = hunter.hp;
  let newMp = hunter.mp;
  let newDungeonKeys = hunter.dungeonKeys;

  if (item.name === "Dungeon Key") {
    newDungeonKeys++;
    await ctx.replyWithHTML(`🔑 Dungeon key added! You now have <b>${newDungeonKeys}</b> keys.`);
  } else {
    if (item.hpRestore > 0) {
      newHp = Math.min(hunter.maxHp, hunter.hp + item.hpRestore);
    }
    if (item.mpRestore > 0) {
      newMp = Math.min(hunter.maxMp, hunter.mp + item.mpRestore);
    }
    await ctx.replyWithHTML(
      `${item.emoji} <b>${item.name}</b> used!\n` +
        `❤️ HP: <b>${hunter.hp} → ${newHp}</b>\n` +
        `💙 MP: <b>${hunter.mp} → ${newMp}</b>`,
    );
  }

  await db
    .update(huntersTable)
    .set({ hp: newHp, mp: newMp, dungeonKeys: newDungeonKeys })
    .where(eq(huntersTable.id, hunter.id));

  // Remove from inventory
  if (invRow.quantity <= 1) {
    await db.delete(inventoryTable).where(eq(inventoryTable.id, invRow.id));
  } else {
    await db
      .update(inventoryTable)
      .set({ quantity: invRow.quantity - 1 })
      .where(eq(inventoryTable.id, invRow.id));
  }
}
