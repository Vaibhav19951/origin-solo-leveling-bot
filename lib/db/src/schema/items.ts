import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // weapon | armor | potion | material
  rank: text("rank").notNull().default("E"),
  description: text("description").notNull(),
  price: integer("price").notNull().default(100),
  hpRestore: integer("hp_restore").notNull().default(0),
  mpRestore: integer("mp_restore").notNull().default(0),
  strBonus: integer("str_bonus").notNull().default(0),
  agiBonus: integer("agi_bonus").notNull().default(0),
  intBonus: integer("int_bonus").notNull().default(0),
  perBonus: integer("per_bonus").notNull().default(0),
  maxHpBonus: integer("max_hp_bonus").notNull().default(0),
  emoji: text("emoji").notNull().default("📦"),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;
