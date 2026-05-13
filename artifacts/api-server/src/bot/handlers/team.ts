import type { Context } from "telegraf";
import { db, huntersTable, teamsTable, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";
import { getAuraById } from "../data/auras";
import type { Telegraf } from "telegraf";
import { logger } from "../../lib/logger";

const MAX_TEAM_SIZE = 4;

let botInstance: Telegraf | null = null;
export function setTeamBotInstance(bot: Telegraf): void { botInstance = bot; }

async function getHunterTeam(hunterId: number) {
  const [membership] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.hunterId, hunterId));
  if (!membership) return null;
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, membership.teamId));
  return team ? { team, membership } : null;
}

export async function handleTeam(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const parts = text.split(" ").slice(1);
  const subCmd = (parts[0] || "info").toLowerCase();

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  switch (subCmd) {
    case "create": await teamCreate(ctx, hunter, parts.slice(1).join(" ")); break;
    case "invite": await teamInvite(ctx, hunter, parts[1]); break;
    case "kick": await teamKick(ctx, hunter, parts[1]); break;
    case "leave": await teamLeave(ctx, hunter); break;
    case "disband": await teamDisband(ctx, hunter); break;
    default: await teamInfo(ctx, hunter); break;
  }
}

async function teamInfo(ctx: Context, hunter: typeof huntersTable.$inferSelect): Promise<void> {
  const info = await getHunterTeam(hunter.id);
  if (!info) {
    await ctx.replyWithHTML(
      `⚔️ <b>TEAM SYSTEM</b>\n\nYou are not in a team.\n\n` +
      `<b>Commands:</b>\n` +
      `/team create [name] — Form a new team\n` +
      `/team invite @user — Invite a hunter\n` +
      `/team kick @user — Remove a member\n` +
      `/team leave — Leave your team\n` +
      `/team disband — Dissolve the team\n` +
      `/summon @user — Quick invite\n\n` +
      `Teams get bonus XP in dungeons!`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "⚔️ Create a Team", callback_data: "team_create_prompt" }]],
        },
      },
    );
    return;
  }

  const { team } = info;
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));
  const memberDetails = await Promise.all(
    members.map(async (m) => {
      const [h] = await db.select().from(huntersTable).where(eq(huntersTable.id, m.hunterId));
      return h ? { hunter: h, role: m.role } : null;
    }),
  );

  const leader = memberDetails.find((m) => m?.role === "leader");
  const memberList = memberDetails
    .filter(Boolean)
    .map((m) => {
      const rankE = RANK_EMOJIS[m!.hunter.rank] || "⬜";
      const aura = getAuraById(m!.hunter.currentAura);
      const auraEmoji = aura && aura.id !== "none" ? aura.emoji : "";
      const roleIcon = m!.role === "leader" ? "👑" : "•";
      return `  ${roleIcon} ${rankE} ${m!.hunter.firstName || m!.hunter.username} ${auraEmoji} Lv.${m!.hunter.level} | ❤️${m!.hunter.hp}/${m!.hunter.maxHp}`;
    })
    .join("\n");

  await ctx.replyWithHTML(
    `${team.emblem} <b>${team.name}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👑 Leader: <b>${leader?.hunter.firstName || leader?.hunter.username || "Unknown"}</b>\n` +
    `👥 Members: <b>${members.length}/${MAX_TEAM_SIZE}</b>\n` +
    `🏰 Dungeons Cleared: <b>${team.dungeonsCleared}</b>\n\n` +
    `<b>Team Roster:</b>\n${memberList}\n\n` +
    `/summon @username to recruit`,
  );
}

async function teamCreate(ctx: Context, hunter: typeof huntersTable.$inferSelect, name: string): Promise<void> {
  if (!name.trim()) { await ctx.replyWithHTML(`Usage: /team create [name]\nExample: /team create Shadow Soldiers`); return; }
  const existing = await getHunterTeam(hunter.id);
  if (existing) { await ctx.replyWithHTML(`⚠️ You are already in team: <b>${existing.team.name}</b>\nLeave first with /team leave`); return; }

  const [team] = await db.insert(teamsTable).values({
    name: name.trim().slice(0, 30), leaderId: hunter.id, membersCount: 1, emblem: "⚔️",
  }).returning();

  await db.insert(teamMembersTable).values({ teamId: team.id, hunterId: hunter.id, role: "leader" });
  await db.update(huntersTable).set({ teamId: team.id }).where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `⚔️ <b>TEAM FORMED!</b>\n\nTeam: <b>${team.name}</b>\nLeader: <b>${hunter.firstName || hunter.username}</b>\n` +
    `Capacity: <b>1/${MAX_TEAM_SIZE}</b>\n\n` +
    `Use /summon @username or /team invite @username to recruit!\nTeam dungeons give <b>+20% bonus XP</b>!`,
  );
}

export async function handleSummon(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const targetInput = text.split(" ")[1];
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) { await ctx.replyWithHTML(`⚠️ Register first with /start`); return; }

  await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));

  if (!targetInput) {
    await ctx.replyWithHTML(`Usage: /summon @username\nThis invites a hunter to your team.`);
    return;
  }

  // Create team if leader doesn't have one
  let info = await getHunterTeam(hunter.id);
  if (!info) {
    const teamName = `${hunter.firstName || hunter.username}'s Team`;
    const [team] = await db.insert(teamsTable).values({ name: teamName, leaderId: hunter.id, membersCount: 1, emblem: "⚔️" }).returning();
    await db.insert(teamMembersTable).values({ teamId: team.id, hunterId: hunter.id, role: "leader" });
    await db.update(huntersTable).set({ teamId: team.id }).where(eq(huntersTable.id, hunter.id));
    info = await getHunterTeam(hunter.id);
  }

  if (!info) { await ctx.replyWithHTML(`⚠️ Failed to create team.`); return; }
  if (info.membership.role !== "leader") { await ctx.replyWithHTML(`⚠️ Only the team leader can summon members.`); return; }

  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, info.team.id));
  if (members.length >= MAX_TEAM_SIZE) { await ctx.replyWithHTML(`⚠️ Team is full! (${MAX_TEAM_SIZE}/${MAX_TEAM_SIZE})`); return; }

  const username = targetInput.replace("@", "").toLowerCase();
  const all = await db.select().from(huntersTable);
  const target = all.find((h) => (h.username || "").toLowerCase() === username || (h.firstName || "").toLowerCase() === username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter "<b>${username}</b>" not found.`); return; }
  if (target.id === hunter.id) { await ctx.replyWithHTML(`⚠️ You can't summon yourself.`); return; }

  const targetTeam = await getHunterTeam(target.id);
  if (targetTeam) { await ctx.replyWithHTML(`⚠️ This hunter is already in a team: <b>${targetTeam.team.name}</b>`); return; }

  if (botInstance) {
    try {
      await botInstance.telegram.sendMessage(
        target.telegramId,
        `⚔️ <b>TEAM SUMMON!</b>\n\n<b>${hunter.firstName || hunter.username}</b> is calling you to join team <b>${info.team.name}</b>!\n\nWill you answer the summon?`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Join Team", callback_data: `team_join_${info.team.id}` },
              { text: "❌ Decline", callback_data: `team_decline_${info.team.id}` },
            ]],
          },
        },
      );
      await ctx.replyWithHTML(`✅ Summon sent to <b>${target.firstName || target.username}</b>!`);
    } catch (err) {
      logger.warn({ err }, "Failed to send team summon");
      await ctx.replyWithHTML(`⚠️ Could not reach that hunter.`);
    }
  }
}

async function teamInvite(ctx: Context, hunter: typeof huntersTable.$inferSelect, targetInput?: string): Promise<void> {
  if (!targetInput) { await ctx.replyWithHTML(`Usage: /team invite @username`); return; }
  // Reuse summon logic by simulating a summon message
  const fakeMsg = `_summon_ @${targetInput}`;
  await handleSummon({ ...ctx, message: { ...ctx.message, text: `/summon @${targetInput}` } } as Context);
}

async function teamKick(ctx: Context, hunter: typeof huntersTable.$inferSelect, targetInput?: string): Promise<void> {
  const info = await getHunterTeam(hunter.id);
  if (!info || info.membership.role !== "leader") { await ctx.replyWithHTML(`⚠️ Only the team leader can kick members.`); return; }
  const username = (targetInput || "").replace("@", "").toLowerCase();
  if (!username) { await ctx.replyWithHTML(`Usage: /team kick @username`); return; }
  const all = await db.select().from(huntersTable);
  const target = all.find((h) => (h.username || "").toLowerCase() === username || (h.firstName || "").toLowerCase() === username);
  if (!target) { await ctx.replyWithHTML(`⚠️ Hunter not found.`); return; }
  if (target.id === hunter.id) { await ctx.replyWithHTML(`⚠️ Can't kick yourself.`); return; }
  const [tm] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.hunterId, target.id));
  if (!tm || tm.teamId !== info.team.id) { await ctx.replyWithHTML(`⚠️ Not in your team.`); return; }
  await db.delete(teamMembersTable).where(eq(teamMembersTable.hunterId, target.id));
  await db.update(huntersTable).set({ teamId: null }).where(eq(huntersTable.id, target.id));
  await db.update(teamsTable).set({ membersCount: Math.max(1, info.team.membersCount - 1) }).where(eq(teamsTable.id, info.team.id));
  await ctx.replyWithHTML(`✅ <b>${target.firstName || target.username}</b> removed from the team.`);
}

async function teamLeave(ctx: Context, hunter: typeof huntersTable.$inferSelect): Promise<void> {
  const info = await getHunterTeam(hunter.id);
  if (!info) { await ctx.replyWithHTML(`⚠️ You are not in a team.`); return; }
  if (info.membership.role === "leader") { await ctx.replyWithHTML(`⚠️ Leaders can't leave. Use /team disband to dissolve the team.`); return; }
  await db.delete(teamMembersTable).where(eq(teamMembersTable.hunterId, hunter.id));
  await db.update(huntersTable).set({ teamId: null }).where(eq(huntersTable.id, hunter.id));
  await db.update(teamsTable).set({ membersCount: Math.max(1, info.team.membersCount - 1) }).where(eq(teamsTable.id, info.team.id));
  await ctx.replyWithHTML(`👋 You left team <b>${info.team.name}</b>.`);
}

async function teamDisband(ctx: Context, hunter: typeof huntersTable.$inferSelect): Promise<void> {
  const info = await getHunterTeam(hunter.id);
  if (!info || info.membership.role !== "leader") { await ctx.replyWithHTML(`⚠️ Only the team leader can disband.`); return; }
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, info.team.id));
  for (const m of members) {
    await db.delete(teamMembersTable).where(eq(teamMembersTable.hunterId, m.hunterId));
    await db.update(huntersTable).set({ teamId: null }).where(eq(huntersTable.id, m.hunterId));
  }
  await db.delete(teamsTable).where(eq(teamsTable.id, info.team.id));
  await ctx.replyWithHTML(`🏚️ Team <b>${info.team.name}</b> has been disbanded.`);
}

export async function handleTeamJoinCallback(ctx: Context, teamId: number): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.from;
  if (!user) return;
  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (!hunter) return;
  const existing = await getHunterTeam(hunter.id);
  if (existing) { await ctx.replyWithHTML(`⚠️ Already in team: <b>${existing.team.name}</b>`); return; }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { await ctx.replyWithHTML(`⚠️ Team no longer exists.`); return; }
  const members = await db.select().from(teamMembersTable).where(eq(teamMembersTable.teamId, teamId));
  if (members.length >= MAX_TEAM_SIZE) { await ctx.replyWithHTML(`⚠️ Team is full!`); return; }
  await db.insert(teamMembersTable).values({ teamId, hunterId: hunter.id, role: "member" });
  await db.update(huntersTable).set({ teamId }).where(eq(huntersTable.id, hunter.id));
  await db.update(teamsTable).set({ membersCount: team.membersCount + 1 }).where(eq(teamsTable.id, teamId));
  await ctx.replyWithHTML(`⚔️ You joined team <b>${team.name}</b>! Use /team to view your squad.`);
}

export async function handleTeamDeclineCallback(ctx: Context): Promise<void> {
  await ctx.answerCbQuery("Declined");
  await ctx.replyWithHTML(`❌ Team invitation declined.`);
}
