import { Telegraf } from "telegraf";
import { db, huntersTable, bannedUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { handleStart } from "./handlers/start";
import { handleProfile } from "./handlers/profile";
import { handleHunt } from "./handlers/hunt";
import { handleDungeon, handleDungeonList } from "./handlers/dungeon";
import { handleInventory, handleUseItem } from "./handlers/inventory";
import { handleShop, handleBuy, handleSell } from "./handlers/shop";
import { handleDaily } from "./handlers/daily";
import { handleRankboard } from "./handlers/rankboard";
import { handleRest } from "./handlers/rest";
import { handleAllocate } from "./handlers/allocate";
import { handleHelp } from "./handlers/help";
import { handleMap, handleMove, handleMoveCallback } from "./handlers/map";
import {
  handlePvp, handlePvpList, handlePvpAccept, handlePvpDecline,
  handlePvpDirectChallenge, setBotInstance,
} from "./handlers/pvp";
import { handleTrade, handleTradeAccept, handleTradeDecline, setTradeBotInstance } from "./handlers/trade";
import { handlePremium, handleBuyPremium, handlePremiumBuyCallback, handlePremiumView } from "./handlers/premium";
import {
  handleGuild, handleGuildJoinCallback, handleGuildDeclineCallback, setGuildBotInstance,
} from "./handlers/guild";
import { handleSpin, handleSpinBuyCallback } from "./handlers/spin";
import { handleExtract, handleShadows } from "./handlers/shadow";
import {
  handleOwnerPanel, handleAddGold, handleAddMana, handleSetLevel,
  handleBanUser, handleUnbanUser, handleBroadcast, handleResetUser,
  handleOwnerList, handleSetUpi, setOwnerBotInstance,
} from "./handlers/owner";
import { handlePayment, handleGenerateQr, handleQrCallback } from "./handlers/payment";
import {
  handleTeam, handleSummon, handleTeamJoinCallback, handleTeamDeclineCallback, setTeamBotInstance,
} from "./handlers/team";
import { handleGates, handleEnterGate } from "./handlers/gates";
import { handleAura, handleSetAura, handleAuraStore, handleBuyAura } from "./handlers/aura";

export function startBot(): Telegraf {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");

  const bot = new Telegraf(token);

  // Share bot instance with handlers that need to DM other users
  setBotInstance(bot);
  setTradeBotInstance(bot);
  setGuildBotInstance(bot);
  setOwnerBotInstance(bot);
  setTeamBotInstance(bot);

  // ─── Global Middleware: Ban Check ─────────────────────────────────────────
  bot.use(async (ctx, next) => {
    const user = ctx.from;
    if (user) {
      try {
        const [banned] = await db.select().from(bannedUsersTable)
          .where(eq(bannedUsersTable.telegramId, String(user.id)));
        if (banned) {
          if (ctx.callbackQuery) await ctx.answerCbQuery("🚫 You are banned.");
          else await ctx.reply("🚫 Your hunter account has been suspended. Contact support.");
          return;
        }
      } catch {}
    }
    await next();
  });

  // ─── Core Commands ─────────────────────────────────────────────────────────
  bot.start(handleStart);
  bot.command("help", handleHelp);
  bot.command("profile", handleProfile);
  bot.command("me", handleProfile);
  bot.command("allocate", handleAllocate);
  bot.command("stats", handleAllocate);

  // ─── Combat ────────────────────────────────────────────────────────────────
  bot.command("hunt", handleHunt);
  bot.command("dungeon", handleDungeon);
  bot.command("dungeons", handleDungeonList);
  bot.command("gates", handleGates);
  bot.command("entergate", handleEnterGate);

  // ─── Shadow System ─────────────────────────────────────────────────────────
  bot.command("arise", handleExtract);
  bot.command("extract", handleExtract);
  bot.command("shadows", handleShadows);
  bot.command("army", handleShadows);

  // ─── Team System ───────────────────────────────────────────────────────────
  bot.command("team", handleTeam);
  bot.command("summon", handleSummon);

  // ─── Guild System ──────────────────────────────────────────────────────────
  bot.command("guild", handleGuild);
  bot.command("g", handleGuild);
  bot.command("createguild", async (ctx) => {
    const text = ctx.message?.text || "";
    const name = text.split(" ").slice(1).join(" ");
    const fakeCtx = { ...ctx, message: { ...ctx.message, text: `/guild create ${name}` } } as typeof ctx;
    await handleGuild(fakeCtx);
  });

  // ─── PvP / Arena ───────────────────────────────────────────────────────────
  bot.command("arena", handlePvp);
  bot.command("pvp", handlePvp);
  bot.command("challenge", handlePvp);
  bot.command("pvplist", handlePvpList);

  // ─── Aura System ───────────────────────────────────────────────────────────
  bot.command("aura", handleAura);
  bot.command("setaura", handleSetAura);
  bot.command("aurastore", handleAuraStore);
  bot.command("buyaura", handleBuyAura);

  // ─── World Map ─────────────────────────────────────────────────────────────
  bot.command("map", handleMap);
  bot.command("move", handleMove);

  // ─── Items & Shop ──────────────────────────────────────────────────────────
  bot.command("inventory", handleInventory);
  bot.command("inv", handleInventory);
  bot.command("use", handleUseItem);
  bot.command("shop", handleShop);
  bot.command("buy", handleBuy);
  bot.command("sell", handleSell);

  // ─── Economy ───────────────────────────────────────────────────────────────
  bot.command("daily", handleDaily);
  bot.command("rest", handleRest);
  bot.command("trade", handleTrade);
  bot.command("send", handleTrade);
  bot.command("spin", handleSpin);
  bot.command("lottery", handleSpin);

  // ─── Premium & Payment ─────────────────────────────────────────────────────
  bot.command("premium", handlePremium);
  bot.command("buy_premium", (ctx) => handleBuyPremium(ctx));
  bot.command("mythic", handlePremium);
  bot.command("payment", handlePayment);
  bot.command("pay", handlePayment);
  bot.command("qr", (ctx) => handleGenerateQr(ctx));

  // ─── Rankings ──────────────────────────────────────────────────────────────
  bot.command("rank", handleRankboard);
  bot.command("leaderboard", handleRankboard);

  // ─── Owner-Only Commands ───────────────────────────────────────────────────
  bot.command("owner", handleOwnerPanel);
  bot.command("addgold", handleAddGold);
  bot.command("addmana", handleAddMana);
  bot.command("setlevel", handleSetLevel);
  bot.command("ban", handleBanUser);
  bot.command("unban", handleUnbanUser);
  bot.command("broadcast", handleBroadcast);
  bot.command("resetuser", handleResetUser);
  bot.command("ownerlist", handleOwnerList);
  bot.command("setupi", handleSetUpi);

  // ─── Inline Keyboard Callbacks ─────────────────────────────────────────────
  bot.action("action_hunt", async (ctx) => { await ctx.answerCbQuery(); await handleHunt(ctx); });
  bot.action("action_dungeon", async (ctx) => { await ctx.answerCbQuery(); await handleDungeon(ctx); });
  bot.action("action_gates", async (ctx) => { await ctx.answerCbQuery(); await handleGates(ctx); });
  bot.action("action_inventory", async (ctx) => { await ctx.answerCbQuery(); await handleInventory(ctx); });
  bot.action("action_shop", async (ctx) => { await ctx.answerCbQuery(); await handleShop(ctx); });
  bot.action("action_daily", async (ctx) => { await ctx.answerCbQuery(); await handleDaily(ctx); });
  bot.action("action_rank", async (ctx) => { await ctx.answerCbQuery(); await handleRankboard(ctx); });
  bot.action("action_profile", async (ctx) => { await ctx.answerCbQuery(); await handleProfile(ctx); });
  bot.action("action_rest", async (ctx) => { await ctx.answerCbQuery(); await handleRest(ctx); });
  bot.action("action_map", async (ctx) => { await ctx.answerCbQuery(); await handleMap(ctx); });
  bot.action("action_pvp_list", async (ctx) => { await ctx.answerCbQuery(); await handlePvpList(ctx); });
  bot.action("action_premium", async (ctx) => { await ctx.answerCbQuery(); await handlePremium(ctx); });
  bot.action("action_extract", async (ctx) => { await ctx.answerCbQuery(); await handleExtract(ctx); });
  bot.action("action_shadows", async (ctx) => { await ctx.answerCbQuery(); await handleShadows(ctx); });
  bot.action("action_spin", async (ctx) => { await ctx.answerCbQuery(); await handleSpin(ctx); });
  bot.action("action_guild", async (ctx) => { await ctx.answerCbQuery(); await handleGuild(ctx); });
  bot.action("action_team", async (ctx) => { await ctx.answerCbQuery(); await handleTeam(ctx); });
  bot.action("action_payment", async (ctx) => { await ctx.answerCbQuery(); await handlePayment(ctx); });
  bot.action("action_aura", async (ctx) => { await ctx.answerCbQuery(); await handleAura(ctx); });
  bot.action("action_aurastore", async (ctx) => { await ctx.answerCbQuery(); await handleAuraStore(ctx); });
  bot.action("action_help", async (ctx) => { await ctx.answerCbQuery(); await handleHelp(ctx); });
  bot.action("spin_buy", handleSpinBuyCallback);
  bot.action("team_create_prompt", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(`To create a team, use:\n/team create [team name]\n\nExample: <code>/team create Shadow Soldiers</code>`);
  });

  // QR callbacks
  bot.action(/^qr_(\d+)$/, async (ctx) => {
    const amount = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleQrCallback(ctx, amount);
  });

  // Zone move callbacks
  bot.action(/^move_(.+)$/, async (ctx) => {
    const zoneName = (ctx.match as RegExpMatchArray)[1];
    await handleMoveCallback(ctx, zoneName);
  });

  // PvP callbacks
  bot.action(/^pvp_accept_(\d+)$/, async (ctx) => {
    const challengerId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handlePvpAccept(ctx, challengerId);
  });
  bot.action(/^pvp_decline_(\d+)$/, async (ctx) => {
    const challengerId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handlePvpDecline(ctx, challengerId);
  });
  bot.action(/^pvp_challenge_(\d+)_(\d+)$/, async (ctx) => {
    const targetId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    const manaBet = parseInt((ctx.match as RegExpMatchArray)[2], 10);
    await handlePvpDirectChallenge(ctx, targetId, manaBet);
  });

  // Trade callbacks
  bot.action(/^trade_accept_(\d+)$/, async (ctx) => {
    const tradeId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleTradeAccept(ctx, tradeId);
  });
  bot.action(/^trade_decline_(\d+)$/, async (ctx) => {
    const tradeId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleTradeDecline(ctx, tradeId);
  });

  // Premium callbacks
  bot.action(/^premium_buy_(.+)$/, async (ctx) => {
    const charId = (ctx.match as RegExpMatchArray)[1];
    await handlePremiumBuyCallback(ctx, charId);
  });
  bot.action(/^premium_view_(.+)$/, async (ctx) => {
    const charId = (ctx.match as RegExpMatchArray)[1];
    await handlePremiumView(ctx, charId);
  });

  // Guild callbacks
  bot.action(/^guild_join_(\d+)$/, async (ctx) => {
    const guildId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleGuildJoinCallback(ctx, guildId);
  });
  bot.action(/^guild_decline_(\d+)$/, handleGuildDeclineCallback);

  // Team callbacks
  bot.action(/^team_join_(\d+)$/, async (ctx) => {
    const teamId = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleTeamJoinCallback(ctx, teamId);
  });
  bot.action(/^team_decline_(\d+)$/, handleTeamDeclineCallback);

  // Owner panel callbacks
  bot.action("owner_list", async (ctx) => { await ctx.answerCbQuery(); await handleOwnerList(ctx); });
  bot.action("owner_banned", async (ctx) => {
    await ctx.answerCbQuery();
    const banned = await db.select().from(bannedUsersTable);
    if (banned.length === 0) { await ctx.replyWithHTML(`✅ No banned users.`); return; }
    const list = banned.map((b, i) => `${i + 1}. <code>${b.telegramId}</code> — ${b.reason}`).join("\n");
    await ctx.replyWithHTML(`🚫 <b>Banned Users (${banned.length})</b>\n\n${list}`);
  });

  // Catch-all
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      await ctx.replyWithHTML(`⚠️ Unknown command: <b>${text.split(" ")[0]}</b>\nUse /help to see all commands.`);
    }
  });

  bot.catch((err: unknown, ctx) => {
    logger.error({ err, update: ctx.update }, "Telegram bot error");
  });

  bot.launch({
    allowedUpdates: ["message", "callback_query"],
    dropPendingUpdates: true,
  });

  logger.info("Telegram bot started (long polling)");
  return bot;
}
