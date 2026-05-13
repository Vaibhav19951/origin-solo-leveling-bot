import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq, gte, ne } from "drizzle-orm";
import { ZONES, getZonesForRank, getZone } from "../data/zones";
import { RANK_EMOJIS } from "../utils/ranks";

const ONLINE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes

export async function handleMap(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  const cutoff = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const allHunters = await db
    .select()
    .from(huntersTable)
    .where(gte(huntersTable.lastSeen, cutoff));

  const huntersByZone = new Map<string, typeof allHunters>();
  for (const z of ZONES) {
    huntersByZone.set(z.name, []);
  }
  for (const h of allHunters) {
    const loc = h.location || "Cartenon Temple";
    if (!huntersByZone.has(loc)) huntersByZone.set(loc, []);
    huntersByZone.get(loc)!.push(h);
  }

  const accessibleZones = getZonesForRank(hunter.rank);
  const accessibleNames = new Set(accessibleZones.map((z) => z.name));

  const mapLines = ZONES.map((z) => {
    const players = huntersByZone.get(z.name) || [];
    const isHere = hunter.location === z.name;
    const accessible = accessibleNames.has(z.name);
    const lockIcon = accessible ? "" : " 🔒";
    const hereIcon = isHere ? " ◀ YOU" : "";

    const playerList = players
      .map((p) => {
        const rankE = RANK_EMOJIS[p.rank] || "⬜";
        const name = p.firstName || p.username || `Hunter#${p.id}`;
        const isYou = p.id === hunter.id ? " (you)" : "";
        return `       • ${rankE} ${name} Lv.${p.level}${isYou}`;
      })
      .join("\n");

    return (
      `${z.emoji} <b>${z.name}</b>${lockIcon}${hereIcon}\n` +
      `   ⚠️ Danger: ${z.danger} | 👥 Online: ${players.length}\n` +
      (playerList ? `${playerList}\n` : `       <i>(empty)</i>\n`)
    );
  });

  const totalOnline = allHunters.length;

  const msg =
    `🗺️ <b>WORLD MAP</b> — Live Hunters\n` +
    `🌐 Online now: <b>${totalOnline}</b> hunter${totalOnline !== 1 ? "s" : ""}\n` +
    `📍 You are in: <b>${hunter.location}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    mapLines.join("\n") +
    `\nUse /move [zone name] to travel`;

  const zoneButtons = accessibleZones
    .filter((z) => z.name !== hunter.location)
    .map((z) => ({ text: `${z.emoji} ${z.name}`, callback_data: `move_${z.name}` }));

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < zoneButtons.length; i += 2) {
    rows.push(zoneButtons.slice(i, i + 2));
  }
  rows.push([
    { text: "⚔️ Hunt Here", callback_data: "action_hunt" },
    { text: "👥 PvP Challenge", callback_data: "action_pvp_list" },
  ]);

  await ctx.replyWithHTML(msg, {
    reply_markup: { inline_keyboard: rows },
  });
}

export async function handleMove(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) {
    await ctx.replyWithHTML(`⚠️ Register first with /start`);
    return;
  }

  const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
  const zoneName = text.split(" ").slice(1).join(" ").trim();

  if (!zoneName) {
    const accessible = getZonesForRank(hunter.rank);
    const list = accessible.map((z) => `${z.emoji} <b>${z.name}</b> — Danger: ${z.danger}`).join("\n");
    await ctx.replyWithHTML(
      `📍 You are in: <b>${hunter.location}</b>\n\nAvailable zones:\n${list}\n\nUsage: /move [zone name]`,
    );
    return;
  }

  const zone = getZone(zoneName);
  if (!zone) {
    await ctx.replyWithHTML(`⚠️ Zone not found. Use /map to see available zones.`);
    return;
  }

  const accessible = getZonesForRank(hunter.rank);
  if (!accessible.find((z) => z.name === zone.name)) {
    await ctx.replyWithHTML(
      `🔒 <b>${zone.name}</b> is locked.\nRequired minimum rank: <b>${zone.minRank}</b>\nYour rank: <b>${hunter.rank}</b>`,
    );
    return;
  }

  if (hunter.location === zone.name) {
    await ctx.replyWithHTML(`📍 You are already in <b>${zone.name}</b>!`);
    return;
  }

  await db
    .update(huntersTable)
    .set({ location: zone.name, lastSeen: new Date() })
    .where(eq(huntersTable.id, hunter.id));

  await ctx.replyWithHTML(
    `🗺️ <b>FAST TRAVEL</b>\n\n` +
      `${zone.emoji} Arrived at: <b>${zone.name}</b>\n` +
      `⚠️ Danger Level: <b>${zone.danger}</b>\n\n` +
      `<i>${zone.description}</i>\n\n` +
      `Use /map to see who else is here.\nUse /hunt to battle local monsters.\nUse /pvp @username to challenge hunters here!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⚔️ Hunt Here", callback_data: "action_hunt" },
            { text: "🗺️ View Map", callback_data: "action_map" },
          ],
          [{ text: "👥 Challenge Someone", callback_data: "action_pvp_list" }],
        ],
      },
    },
  );
}

export async function handleMoveCallback(ctx: Context, zoneName: string): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db
    .select()
    .from(huntersTable)
    .where(eq(huntersTable.telegramId, String(user.id)));

  if (!hunter) return;

  const zone = getZone(zoneName);
  if (!zone) return;

  const accessible = getZonesForRank(hunter.rank);
  if (!accessible.find((z) => z.name === zone.name)) {
    await ctx.answerCbQuery(`🔒 Rank too low for ${zone.name}`, { show_alert: true });
    return;
  }

  await db
    .update(huntersTable)
    .set({ location: zone.name, lastSeen: new Date() })
    .where(eq(huntersTable.id, hunter.id));

  await ctx.answerCbQuery(`✅ Moved to ${zone.name}!`);
  await ctx.replyWithHTML(
    `🗺️ <b>FAST TRAVEL</b>\n${zone.emoji} Arrived at: <b>${zone.name}</b>\n⚠️ Danger: <b>${zone.danger}</b>\n\n<i>${zone.description}</i>`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⚔️ Hunt Here", callback_data: "action_hunt" },
            { text: "🗺️ View Map", callback_data: "action_map" },
          ],
        ],
      },
    },
  );
}
