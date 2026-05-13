import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildsTable = pgTable("guilds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  ownerId: integer("owner_id").notNull(),
  treasury: integer("treasury").notNull().default(0),
  membersCount: integer("members_count").notNull().default(1),
  dungeonsCleared: integer("dungeons_cleared").notNull().default(0),
  totalPvpWins: integer("total_pvp_wins").notNull().default(0),
  emblem: text("emblem").notNull().default("🏰"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGuildSchema = createInsertSchema(guildsTable).omit({ id: true, createdAt: true });
export type InsertGuild = z.infer<typeof insertGuildSchema>;
export type Guild = typeof guildsTable.$inferSelect;
