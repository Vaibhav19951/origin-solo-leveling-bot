import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { huntersTable } from "./hunters";

export const huntLogTable = pgTable("hunt_log", {
  id: serial("id").primaryKey(),
  hunterId: integer("hunter_id").notNull().references(() => huntersTable.id),
  monsterName: text("monster_name").notNull(),
  result: text("result").notNull(), // win | loss
  xpGained: integer("xp_gained").notNull().default(0),
  goldGained: integer("gold_gained").notNull().default(0),
  hpLost: integer("hp_lost").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHuntLogSchema = createInsertSchema(huntLogTable).omit({ id: true, createdAt: true });
export type InsertHuntLog = z.infer<typeof insertHuntLogSchema>;
export type HuntLog = typeof huntLogTable.$inferSelect;
