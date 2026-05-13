import { pgTable, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { huntersTable } from "./hunters";
import { itemsTable } from "./items";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  hunterId: integer("hunter_id").notNull().references(() => huntersTable.id),
  itemId: integer("item_id").notNull().references(() => itemsTable.id),
  quantity: integer("quantity").notNull().default(1),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
