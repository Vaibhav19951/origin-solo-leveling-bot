import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildMembersTable = pgTable("guild_members", {
  id: serial("id").primaryKey(),
  guildId: integer("guild_id").notNull(),
  hunterId: integer("hunter_id").notNull().unique(),
  role: text("role").notNull().default("member"), // owner | officer | member
  contributedGold: integer("contributed_gold").notNull().default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGuildMemberSchema = createInsertSchema(guildMembersTable).omit({ id: true, joinedAt: true });
export type InsertGuildMember = z.infer<typeof insertGuildMemberSchema>;
export type GuildMember = typeof guildMembersTable.$inferSelect;
