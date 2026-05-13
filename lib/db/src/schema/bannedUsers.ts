import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bannedUsersTable = pgTable("banned_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  reason: text("reason").notNull().default("No reason provided"),
  bannedAt: timestamp("banned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBannedUserSchema = createInsertSchema(bannedUsersTable).omit({ id: true, bannedAt: true });
export type InsertBannedUser = z.infer<typeof insertBannedUserSchema>;
export type BannedUser = typeof bannedUsersTable.$inferSelect;
