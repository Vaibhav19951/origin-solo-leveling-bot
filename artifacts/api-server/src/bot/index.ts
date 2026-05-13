import { Telegraf } from "telegraf";
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
  handlePvp,
  handlePvpList,
  handlePvpAccept,
  handlePvpDecline,
  handlePvpDirectChallenge,
  setBotInstance,
} from "./handlers/pvp";
import { handleTrade, handleTradeAccept, handleTradeDecline, setTradeBotInstance } from "./handlers/trade";
import { handlePremium, handleBuyPremium, handlePremiumBuyCallback, handlePremiumView } from "./handlers/premium";

export function startBot(): Telegraf {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");

  const bot = new Telegraf(token);

  // Share bot instance with handlers that need to DM other users
  setBotInstance(bot);
  setTradeBotInstance(bot);

  // ─── Commands ──────────────────────────────────────────────────────────────
  bot.start(handleStart);
  bot.command("help", handleHelp);
  bot.command("profile", handleProfile);
  bot.command("me", handleProfile);
  bot.command("hunt", handleHunt);
  bot.command("dungeon", handleDungeon);
  bot.command("dungeons", handleDungeonList);
  bot.command("inventory", handleInventory);
  bot.command("inv", handleInventory);
  bot.command("use", handleUseItem);
  bot.command("shop", handleShop);
  bot.command("buy", handleBuy);
  bot.command("sell", handleSell);
  bot.command("daily", handleDaily);
  bot.command("rank", handleRankboard);
  bot.command("leaderboard", handleRankboard);
  bot.command("rest", handleRest);
  bot.command("allocate", handleAllocate);
  bot.command("stats", handleAllocate);
  // World Map
  bot.command("map", handleMap);
  bot.command("move", handleMove);
  // PvP
  bot.command("pvp", handlePvp);
  bot.command("challenge", handlePvp);
  // Trade
  bot.command("trade", handleTrade);
  bot.command("send", handleTrade);
  // Premium
  bot.command("premium", handlePremium);
  bot.command("buy_premium", (ctx) => handleBuyPremium(ctx));
  bot.command("mythic", handlePremium);

  // ─── Inline Keyboard Callbacks ────────────────────────────────────────────
  bot.action("action_hunt", async (ctx) => { await ctx.answerCbQuery(); await handleHunt(ctx); });
  bot.action("action_dungeon", async (ctx) => { await ctx.answerCbQuery(); await handleDungeon(ctx); });
  bot.action("action_inventory", async (ctx) => { await ctx.answerCbQuery(); await handleInventory(ctx); });
  bot.action("action_shop", async (ctx) => { await ctx.answerCbQuery(); await handleShop(ctx); });
  bot.action("action_daily", async (ctx) => { await ctx.answerCbQuery(); await handleDaily(ctx); });
  bot.action("action_rank", async (ctx) => { await ctx.answerCbQuery(); await handleRankboard(ctx); });
  bot.action("action_profile", async (ctx) => { await ctx.answerCbQuery(); await handleProfile(ctx); });
  bot.action("action_rest", async (ctx) => { await ctx.answerCbQuery(); await handleRest(ctx); });
  bot.action("action_map", async (ctx) => { await ctx.answerCbQuery(); await handleMap(ctx); });
  bot.action("action_pvp_list", async (ctx) => { await ctx.answerCbQuery(); await handlePvpList(ctx); });
  bot.action("action_premium", async (ctx) => { await ctx.answerCbQuery(); await handlePremium(ctx); });

  // Move zone callbacks
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

  // Catch-all for unknown commands
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      await ctx.replyWithHTML(
        `⚠️ Unknown command: <b>${text.split(" ")[0]}</b>\nUse /help to see all commands.`,
      );
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
