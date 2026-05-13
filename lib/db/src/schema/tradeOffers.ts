import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { huntersTable } from "./hunters";

export const tradeOffersTable = pgTable("trade_offers", {
  id: serial("id").primaryKey(),
  fromId: integer("from_id").notNull().references(() => huntersTable.id),
  toId: integer("to_id").notNull().references(() => huntersTable.id),
  manaCoins: integer("mana_coins").notNull().default(0),
  gold: integer("gold").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | expired
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTradeOfferSchema = createInsertSchema(tradeOffersTable).omit({ id: true, createdAt: true });
export type InsertTradeOffer = z.infer<typeof insertTradeOfferSchema>;
export type TradeOffer = typeof tradeOffersTable.$inferSelect;
