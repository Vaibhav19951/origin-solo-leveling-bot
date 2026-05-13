import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const huntersTable = pgTable("hunters", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  rank: text("rank").notNull().default("E"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  xpToNextLevel: integer("xp_to_next_level").notNull().default(100),
  hp: integer("hp").notNull().default(100),
  maxHp: integer("max_hp").notNull().default(100),
  mp: integer("mp").notNull().default(50),
  maxMp: integer("max_mp").notNull().default(50),
  strength: integer("strength").notNull().default(10),
  agility: integer("agility").notNull().default(8),
  intelligence: integer("intelligence").notNull().default(6),
  perception: integer("perception").notNull().default(7),
  gold: integer("gold").notNull().default(500),
  manaCoin: integer("mana_coin").notNull().default(0),
  dungeonKeys: integer("dungeon_keys").notNull().default(3),
  statPoints: integer("stat_points").notNull().default(0),
  location: text("location").notNull().default("Cartenon Temple"),
  premiumCharacter: text("premium_character"),
  lastHunt: timestamp("last_hunt", { withTimezone: true }),
  lastDaily: timestamp("last_daily", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  lastSpin: timestamp("last_spin", { withTimezone: true }),
  lastKilledMonster: text("last_killed_monster"),
  lastKilledMonsterRank: text("last_killed_monster_rank"),
  lastKilledMonsterEmoji: text("last_killed_monster_emoji"),
  isBanned: boolean("is_banned").notNull().default(false),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  pvpWins: integer("pvp_wins").notNull().default(0),
  pvpLosses: integer("pvp_losses").notNull().default(0),
  monstersKilled: integer("monsters_killed").notNull().default(0),
  dungeonsCleared: integer("dungeons_cleared").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHunterSchema = createInsertSchema(huntersTable).omit({ id: true, createdAt: true });
export type InsertHunter = z.infer<typeof insertHunterSchema>;
export type Hunter = typeof huntersTable.$inferSelect;
