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

export function startBot(): Telegraf {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  const bot = new Telegraf(token);

  // Commands
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

  // Callback query handlers (inline keyboard buttons)
  bot.action("action_hunt", async (ctx) => {
    await ctx.answerCbQuery();
    await handleHunt(ctx);
  });
  bot.action("action_dungeon", async (ctx) => {
    await ctx.answerCbQuery();
    await handleDungeon(ctx);
  });
  bot.action("action_inventory", async (ctx) => {
    await ctx.answerCbQuery();
    await handleInventory(ctx);
  });
  bot.action("action_shop", async (ctx) => {
    await ctx.answerCbQuery();
    await handleShop(ctx);
  });
  bot.action("action_daily", async (ctx) => {
    await ctx.answerCbQuery();
    await handleDaily(ctx);
  });
  bot.action("action_rank", async (ctx) => {
    await ctx.answerCbQuery();
    await handleRankboard(ctx);
  });

  // Catch unknown commands
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) {
      await ctx.replyWithHTML(
        `⚠️ Unknown command: <b>${text.split(" ")[0]}</b>\nUse /help to see all available commands.`,
      );
    }
  });

  // Error handler
  bot.catch((err: unknown, ctx) => {
    logger.error({ err, update: ctx.update }, "Telegram bot error");
  });

  // Launch with long polling — drop pending updates to avoid 409 conflicts on restart
  bot.launch({
    allowedUpdates: ["message", "callback_query"],
    dropPendingUpdates: true,
  });

  logger.info("Telegram bot started (long polling)");

  return bot;
}
