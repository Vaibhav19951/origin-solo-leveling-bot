import type { Context } from "telegraf";
import { db, huntersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RANK_EMOJIS } from "../utils/ranks";

export async function handleHelp(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;

  const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
  if (hunter) {
    await db.update(huntersTable).set({ lastSeen: new Date() }).where(eq(huntersTable.id, hunter.id));
  }

  const rankInfo = hunter
    ? `${RANK_EMOJIS[hunter.rank] || "⬜"} Rank <b>${hunter.rank}</b>  |  Lv.<b>${hunter.level}</b>  |  💎<b>${hunter.manaCoin}</b> MC\n\n`
    : "";

  const helpText =
    `🌑 <b>[ SYSTEM — COMMAND INDEX ]</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    rankInfo +
    `<b>🧑‍💼 Hunter</b>\n` +
    `/start — Register as Hunter\n` +
    `/profile — View your stats\n` +
    `/me — Quick profile\n` +
    `/allocate [stat] [n] — Spend stat points\n\n` +

    `<b>⚔️ Combat</b>\n` +
    `/hunt — Hunt monsters for XP & gold\n` +
    `/dungeon [rank] — Enter a dungeon\n` +
    `/dungeons — List available dungeons\n` +
    `/gates — View active dungeon gates\n` +
    `/entergate [id] — Enter a specific gate\n\n` +

    `<b>🌑 Shadows</b>\n` +
    `/arise — Extract shadow from last kill\n` +
    `/extract — Same as /arise\n` +
    `/shadows — View your shadow army\n` +
    `/army — Same as /shadows\n\n` +

    `<b>👥 Team</b>\n` +
    `/team — View your team\n` +
    `/team create [name] — Form a team\n` +
    `/team invite @user — Invite a hunter\n` +
    `/team kick @user — Remove a member\n` +
    `/team leave — Leave your team\n` +
    `/summon @user — Quick team invite\n\n` +

    `<b>🏰 Guild</b>\n` +
    `/createguild [name] — Create a guild (100k gold)\n` +
    `/guild info — View your guild\n` +
    `/guild list — Browse all guilds\n` +
    `/guild invite @user — Invite member\n` +
    `/guild donate [amount] — Donate gold\n\n` +

    `<b>⚡ PvP</b>\n` +
    `/arena @user [bet] — PvP battle\n` +
    `/challenge @user [bet] — Same as /arena\n` +
    `/pvplist — View pending challenges\n\n` +

    `<b>✨ Aura</b>\n` +
    `/aura — View your aura & owned auras\n` +
    `/setaura [name] — Equip an aura\n` +
    `/aurastore — Browse all auras\n` +
    `/buyaura [name] — Purchase an aura\n\n` +

    `<b>🗺️ World</b>\n` +
    `/map — View world map & online hunters\n` +
    `/move [zone] — Travel to a zone\n\n` +

    `<b>🎒 Items</b>\n` +
    `/inventory — View your items\n` +
    `/use [item] — Use a potion\n` +
    `/shop — Hunter item shop\n` +
    `/buy [item] — Purchase an item\n` +
    `/sell [item] — Sell an item (50% value)\n\n` +

    `<b>💰 Economy</b>\n` +
    `/daily — Claim daily reward\n` +
    `/rest — Recover 50% HP (free)\n` +
    `/trade @user [amount] — Trade gold/MC\n` +
    `/spin — Shadow lottery (free every 6h)\n\n` +

    `<b>💎 Premium</b>\n` +
    `/premium — Mythic character shop\n` +
    `/payment — Payment & UPI QR\n` +
    `/qr [amount] — Generate payment QR\n\n` +

    `<b>📊 Rankings</b>\n` +
    `/rank — Hunter leaderboard\n` +
    `/leaderboard — Same as /rank`;

  await ctx.replyWithHTML(helpText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚔️ Hunt", callback_data: "action_hunt" },
          { text: "🏰 Dungeon", callback_data: "action_dungeon" },
          { text: "🌀 Gates", callback_data: "action_gates" },
        ],
        [
          { text: "🌑 Shadows", callback_data: "action_shadows" },
          { text: "👥 Team", callback_data: "action_team" },
          { text: "✨ Aura", callback_data: "action_aura" },
        ],
        [
          { text: "🎰 Spin", callback_data: "action_spin" },
          { text: "💎 Premium", callback_data: "action_premium" },
          { text: "📊 Profile", callback_data: "action_profile" },
        ],
      ],
    },
  });
}
