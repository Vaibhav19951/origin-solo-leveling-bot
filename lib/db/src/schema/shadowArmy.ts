import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shadowArmyTable = pgTable("shadow_army", {
  id: serial("id").primaryKey(),
  hunterId: integer("hunter_id").notNull(),
  shadowName: text("shadow_name").notNull(),
  monsterName: text("monster_name").notNull(),
  monsterRank: text("monster_rank").notNull().default("E"),
  attack: integer("attack").notNull().default(10),
  hp: integer("hp").notNull().default(50),
  level: integer("level").notNull().default(1),
  emoji: text("emoji").notNull().default("🌑"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShadowArmySchema = createInsertSchema(shadowArmyTable).omit({ id: true, extractedAt: true });
export type InsertShadowArmy = z.infer<typeof insertShadowArmySchema>;
export type ShadowArmy = typeof shadowArmyTable.$inferSelect;
