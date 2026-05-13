import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { huntersTable } from "./hunters";

export const pvpLogTable = pgTable("pvp_log", {
  id: serial("id").primaryKey(),
  challengerId: integer("challenger_id").notNull().references(() => huntersTable.id),
  defenderId: integer("defender_id").notNull().references(() => huntersTable.id),
  winnerId: integer("winner_id").notNull().references(() => huntersTable.id),
  manaCoinTransferred: integer("mana_coin_transferred").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPvpLogSchema = createInsertSchema(pvpLogTable).omit({ id: true, createdAt: true });
export type InsertPvpLog = z.infer<typeof insertPvpLogSchema>;
export type PvpLog = typeof pvpLogTable.$inferSelect;
