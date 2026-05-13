import type { Context } from "telegraf";
import { db, huntersTable, guildsTable, guildMembersTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";
import type { Telegraf } from "telegraf";
import { logger } from "../../lib/logger";

const GUILD_CREATION_COST = 100_000;
const MIN_MEMBERS = 2;

let botInstance: Telegraf | null = null;
export function setGuildBotInstance(bot: Telegraf): void { botInstance = bot; }

async function getHunterGuild(hunterId: number) {
  const [membership] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.hunterId, hunterId));
  if (!membership) return null;
  const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, membership.guildId));
  return guild ? { guild, membership } : null;
}

export async function handleGuild(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const subCmd = (parts[0] || "info").toLowerCase();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  switch (subCmd) {
    case "create": await guildCreate(ctx, hunter, parts.slice(1).join(" ")); break;
    case "info": await guildInfo(ctx, hunter, parts[1]); break;
    case "list": await guildList(ctx); break;
    case "invite": await guildInvite(ctx, hunter, parts[1]); break;
    case "kick": await guildKick(ctx, hunter, parts[1]); break;
    case "leave": await guildLeave(ctx, hunter); break;
    case "donate": await guildDonate(ctx, hunter, parseInt(parts[1] || "0", 10)); break;
    case "disband": await guildDisband(ctx, hunter); break;
    case "promote": await guildPromote(ctx, hunter, parts[1]); break;
    default:
      await ctx.replyWithHTML(
        `🏰 <b>GUILD SYSTEM</b>\n\n` +
        `/guild create [name] — Create guild (💰${GUILD_CREATION_COST.toLocaleString()} gold)\n` +
        `/guild info [name] — View guild details\n` +
        `/guild list — Browse all guilds\n` +
        `/guild invite @user — Invite a hunter\n` +
        `/guild kick @user — Remove a member\n` +
        `/guild leave — Leave your guild\n` +
        `/guild donate [amount] — Donate to guild treasury\n` +
        `/guild promote @user — Make officer\n` +
        `/guild disband — Disband your guild (50% treasury back)\n\n` +
        `💰 Your Gold: <b>${hunter.gold.toLocaleString()}</b>`,
      );
  }
}

async function guildCreate(ctx: Context, hunter: typeof huntersTable.$inferSelect, name: string): Promise<void> {
  if (!name.trim()) { await ctx.replyWithHTML(`Usage: /guild create [guild name]`); return; }
  if (name.length > 30) { await ctx.replyWithHTML(`⚠️ Guild name too long (max 30 chars).`); return; }

  const existing = await getHunterGuild(hunter.id);
  if (existing) { await ctx.replyWithHTML(`⚠️ You are already in a guild: <b>${existing.guild.name}</b>\nLeave first with /guild leave`); return; }

  if (hunter.gold < GUILD_CREATION_COST) {
    await ctx.replyWithHTML(`💰 Insufficient gold.\nRequired: <b>${GUILD_CREATION_COST.toLocaleString()}g</b> | You have: <b>${hunter.gold.toLocaleString()}g</b>`);
    return;
  }

  const [nameCheck] = await db.select().from(guildsTable).where(eq(guildsTable.name, name.trim()));
  if (nameCheck) { await ctx.replyWithHTML(`⚠️ Guild name "<b>${name}</b>" is already taken.`); return; }

  const [guild] = await db.insert(guildsTable).values({
    name: name.trim(), description: "", ownerId: hunter.id, treasury: 0, membersCount: 1, emblem: "🏰",
  }).returning();

  await db.insert(guildMembersTable).values({ guildId: guild.id, hunterId: hunter.id, role: "owner" });
  await db.update(huntersTable).set({ gold: hunter.gold - GUILD_CREATION_COST }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `🏰 <b>GUILD FOUNDED!</b>\n\n` +
    `Guild: <b>${guild.name}</b>\n` +
    `Master: <b>${hunter.firstName || hunter.username}</b>\n` +
    `Treasury: <b>0g</b>\n\n` +
    `Cost deducted: <b>${GUILD_CREATION_COST.toLocaleString()}g</b>\n` +
    `Gold remaining: <b>${(hunter.gold - GUILD_CREATION_COST).toLocaleString()}g</b>\n\n` +
    `Use /guild invite @username to recruit members!\nMinimum ${MIN_MEMBERS} members for guild events.`,
  );
}

async function guildInfo(ctx: Context, hunter: typeof huntersTable.$inferSelect, guildName?: string): Promise<void> {
  let guild;
  if (guildName) {
    [guild] = await db.select().from(guildsTable).where(eq(guildsTable.name, guildName));
  } else {
    const info = await getHunterGuild(hunter.id);
    guild = info?.guild;
  }

  if (!guild) { await ctx.replyWithHTML(`⚠️ ${guildName ? `Guild "<b>${guildName}</b>" not found.` : "You are not in a guild.\nJoin or create one with /guild"}`); return; }

  const members = await db.select().from(guildMembersTable).where(eq(guildMembersTable.guildId, guild.id));
  const memberDetails = await Promise.all(
    members.map(async (m) => {
      const [h] = await db.select().from(huntersTable).where(eq(huntersTable.id, m.hunterId));
      return h ? { hunter: h, role: m.role } : null;
    })
  );

  const owner = memberDetails.find((m) => m?.role === "owner");
  const memberList = memberDetails.filter(Boolean).map((m) => {
    const rankE = RANK_EMOJIS[m!.hunter.rank] || "⬜";
    const roleIcon = m!.role === "owner" ? "👑" : m!.role === "officer" ? "⭐" : "•";
    return `  ${roleIcon} ${rankE} ${m!.hunter.firstName || m!.hunter.username} Lv.${m!.hunter.level}`;
  }).join("\n");

  await ctx.replyWithHTML(
    `${guild.emblem} <b>${guild.name}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👑 Master: <b>${owner?.hunter.firstName || owner?.hunter.username || "Unknown"}</b>\n` +
    `👥 Members: <b>${members.length}</b>\n` +
    `💰 Treasury: <b>${guild.treasury.toLocaleString()}g</b>\n` +
    `🏰 Dungeons Cleared: <b>${guild.dungeonsCleared}</b>\n` +
    `⚔️ PvP Wins: <b>${guild.totalPvpWins}</b>\n\n` +
    `<b>Members:</b>\n${memberList}`,
  );
}

async function guildList(ctx: Context): Promise<void> {
  const guilds = await db.select().from(guildsTable).orderBy(desc(guildsTable.dungeonsCleared)).limit(10);
  if (guilds.length === 0) { await ctx.replyWithHTML(`🏰 No guilds exist yet. Create one with /guild create [name]!`); return; }

  const lines = guilds.map((g, i) =>
    `${i + 1}. ${g.emblem} <b>${g.name}</b> — 👥${g.membersCount} | 🏰${g.dungeonsCleared} dungeons | 💰${g.treasury.toLocaleString()}g`
  );

  await ctx.replyWithHTML(
    `🏰 <b>GUILD RANKINGS</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n` + lines.join("\n") +
    `\n\nView details: /guild info [name]`,
  );
}

async function guildInvite(ctx: Context, hunter: typeof huntersTable.$inferSelect, targetInput?: string): Promise<void> {
  const info = await getHunterGuild(hunter.id);
  if (!info) { await ctx.replyWithHTML(`⚠️ You are not in a guild.`); return; }
  if (info.membership.role !== "owner" && info.membership.role !== "officer") {
    await ctx.replyWithHTML(`⚠️ Only the guild master or officers can invite members.`); return;
  }

  const username = (targetInput || "").replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /guild invite @username`); return; }

  const allHunters = await db.select().from(huntersTable);
  const target = allHunters.find(h => (h.username || "").toLowerCase() === username || (h.firstName || "").toLowerCase() === username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter "<b>${username}</b>" not found.`); return; }

  const targetGuild = await getHunterGuild(target.id);
  if (targetGuild) { await ctx.replyWithHTML(`⚠️ This hunter is already in a guild: <b>${targetGuild.guild.name}</b>`); return; }

  // Send invite via DM
  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(target.telegramId,
        `🏰 <b>GUILD INVITATION!</b>\n\nYou've been invited to join <b>${info.guild.name}</b> by <b>${hunter.firstName || hunter.username}</b>!`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[
            { text: "✅ Join Guild", callback_data: `guild_join_${info.guild.id}` },
            { text: "❌ Decline", callback_data: `guild_decline_${info.guild.id}` },
          ]]},
        },
      );
      await ctx.replyWithHTML(`✅ Invitation sent to <b>${target.firstName || target.username}</b>!`);
    } catch (err) { logger.warn({ err }, "Failed to send guild invite"); await ctx.replyWithHTML(`⚠️ Could not reach that hunter.`); }
  }
}

async function guildKick(ctx: Context, hunter: typeof huntersTable.$inferSelect, targetInput?: string): Promise<void> {
  const info = await getHunterGuild(hunter.id);
  if (!info || (info.membership.role !== "owner" && info.membership.role !== "officer")) {
    await ctx.replyWithHTML(`⚠️ Only guild master or officers can kick members.`); return;
  }
  const username = (targetInput || "").replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /guild kick @username`); return; }
  const allHunters = await db.select().from(huntersTable);
  const target = allHunters.find(h => (h.username || "").toLowerCase() === username || (h.firstName || "").toLowerCase() === username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }
  if (target.id === hunter.id) { await ctx.replyWithHTML(`⚠️ You can't kick yourself.`); return; }

  const targetMembership = await db.select().from(guildMembersTable)
    .where(eq(guildMembersTable.hunterId, target.id));
  if (!targetMembership[0] || targetMembership[0].guildId !== info.guild.id) {
    await ctx.replyWithHTML(`⚠️ This hunter is not in your guild.`); return;
  }
  if (targetMembership[0].role === "owner") { await ctx.replyWithHTML(`⚠️ Cannot kick the guild owner.`); return; }

  await db.delete(guildMembersTable).where(eq(guildMembersTable.hunterId, target.id));
  await db.update(guildsTable).set({ membersCount: info.guild.membersCount - 1 }).where(eq(guildsTable.id, info.guild.id));
  await ctx.replyWithHTML(`✅ <b>${target.firstName || target.username}</b> has been removed from the guild.`);
}

async function guildLeave(ctx: Context, hunter: typeof huntersTable.$inferSelect): Promise<void> {
  const info = await getHunterGuild(hunter.id);
  if (!info) { await ctx.replyWithHTML(`⚠️ You are not in any guild.`); return; }
  if (info.membership.role === "owner") { await ctx.replyWithHTML(`⚠️ Guild masters can't leave. Use /guild disband to dissolve the guild.`); return; }

  await db.delete(guildMembersTable).where(eq(guildMembersTable.hunterId, hunter.id));
  await db.update(guildsTable).set({ membersCount: Math.max(1, info.guild.membersCount - 1) }).where(eq(guildsTable.id, info.guild.id));
  await ctx.replyWithHTML(`👋 You have left <b>${info.guild.name}</b>.`);
}

async function guildDonate(ctx: Context, hunter: typeof huntersTable.$inferSelect, amount: number): Promise<void> {
  if (!amount || amount <= 0) { await ctx.replyWithHTML(`Usage: /guild donate [amount]\nExample: /guild donate 5000`); return; }
  const info = await getHunterGuild(hunter.id);
  if (!info) { await ctx.replyWithHTML(`⚠️ You are not in a guild.`); return; }
  if (hunter.gold < amount) { await ctx.replyWithHTML(`💰 Insufficient gold. You have <b>${hunter.gold.toLocaleString()}g</b>`); return; }

  await db.update(huntersTable).set({ gold: hunter.gold - amount }).where(eq(huntersTable.id, hunter.id));
  await db.update(guildsTable).set({ treasury: info.guild.treasury + amount }).where(eq(guildsTable.id, info.guild.id));
  await db.update(guildMembersTable)
    .set({ contributedGold: info.membership.contributedGold + amount })
    .where(eq(guildMembersTable.hunterId, hunter.id));

  await ctx.replyWithHTML(
    `🏰 <b>GUILD DONATION</b>\n\n` +
    `Donated: <b>${amount.toLocaleString()}g</b> to <b>${info.guild.name}</b>\n` +
    `Treasury: <b>${(info.guild.treasury + amount).toLocaleString()}g</b>\n` +
    `Your gold: <b>${(hunter.gold - amount).toLocaleString()}g</b>`,
  );
}

async function guildDisband(ctx: Context, hunter: typeof huntersTable.$inferSelect): Promise<void> {
  const info = await getHunterGuild(hunter.id);
  if (!info || info.membership.role !== "owner") { await ctx.replyWithHTML(`⚠️ Only the guild master can disband the guild.`); return; }

  const refund = Math.floor(info.guild.treasury * 0.5);
  await db.delete(guildMembersTable).where(eq(guildMembersTable.guildId, info.guild.id));
  await db.delete(guildsTable).where(eq(guildsTable.id, info.guild.id));
  await db.update(huntersTable).set({ gold: hunter.gold + refund }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `🏚️ <b>GUILD DISBANDED</b>\n\nGuild: <b>${info.guild.name}</b>\n💰 Treasury refund (50%): <b>${refund.toLocaleString()}g</b>`,
  );
}

async function guildPromote(ctx: Context, hunter: typeof huntersTable.$inferSelect, targetInput?: string): Promise<void> {
  const info = await getHunterGuild(hunter.id);
  if (!info || info.membership.role !== "owner") { await ctx.replyWithHTML(`⚠️ Only the guild master can promote members.`); return; }
  const username = (targetInput || "").replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /guild promote @username`); return; }
  const allHunters = await db.select().from(huntersTable);
  const target = allHunters.find(h => (h.username || "").toLowerCase() === username || (h.firstName || "").toLowerCase() === username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }
  const [tm] = await db.select().from(guildMembersTable).where(eq(guildMembersTable.hunterId, target.id));
  if (!tm || tm.guildId !== info.guild.id) { await ctx.replyWithHTML(`⚠️ Not in your guild.`); return; }
  await db.update(guildMembersTable).set({ role: "officer" }).where(eq(guildMembersTable.hunterId, target.id));
  await ctx.replyWithHTML(`⭐ <b>${target.firstName || target.username}</b> has been promoted to Officer!`);
}

export async function handleGuildJoinCallback(ctx: Context, guildId: number): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;

  const existing = await getHunterGuild(hunter.id);
  if (existing) { await ctx.replyWithHTML(`⚠️ You are already in guild: <b>${existing.guild.name}</b>`); return; }

  const [guild] = await db.select().from(guildsTable).where(eq(guildsTable.id, guildId));
  if (!guild) { await ctx.replyWithHTML(`⚠️ Guild no longer exists.`); return; }

  await db.insert(guildMembersTable).values({ guildId, hunterId: hunter.id, role: "member" });
  await db.update(guildsTable).set({ membersCount: guild.membersCount + 1 }).where(eq(guildsTable.id, guildId));
  await ctx.replyWithHTML(`🏰 Welcome to <b>${guild.name}</b>!`);
}

export async function handleGuildDeclineCallback(ctx: Context): Promise<void> {
  await ctx.answerCbQuery("Invitation declined");
  await ctx.replyWithHTML(`❌ Guild invitation declined.`);
}
