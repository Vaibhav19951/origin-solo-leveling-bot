import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activeGatesTable = pgTable("active_gates", {
  id: serial("id").primaryKey(),
  dungeonName: text("dungeon_name").notNull(),
  dungeonRank: text("dungeon_rank").notNull(),
  location: text("location").notNull(),
  emoji: text("emoji").notNull().default("🔵"),
  bossName: text("boss_name").notNull(),
  discoveredBy: integer("discovered_by"),
  isCleared: boolean("is_cleared").notNull().default(false),
  clearedBy: integer("cleared_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActiveGateSchema = createInsertSchema(activeGatesTable).omit({ id: true, discoveredAt: true });
export type InsertActiveGate = z.infer<typeof insertActiveGateSchema>;
export type ActiveGate = typeof activeGatesTable.$inferSelect;
