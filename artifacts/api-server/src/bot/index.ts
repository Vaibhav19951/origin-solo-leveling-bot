import { Telegraf } from "telegraf";
import { db, huntersTable, bannedUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { handleStart } from "./handlers/start";
import { handleProfile } from "./handlers/profile";
import { handleHunt, handleCombatAction } from "./handlers/hunt";
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
import {
  handlePayment, handleGenerateQr, handleQrCallback,
  handlePaidNotify, handleApprovePayment, handleRejectPayment,
  setPaymentBotInstance,
} from "./handlers/payment";
import {
  handleTeam, handleSummon, handleTeamJoinCallback, handleTeamDeclineCallback, setTeamBotInstance,
} from "./handlers/team";
import { handleGates, handleEnterGate } from "./handlers/gates";
import { handleAura, handleSetAura, handleAuraStore, handleBuyAura } from "./handlers/aura";
import { handleEquip, handleWeaponShop, handleBuyWeapon, handleUnequip } from "./handlers/equip";
import type { CombatMove } from "./utils/combatEngine";

export function startBot(): Telegraf {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");

  const bot = new Telegraf(token);

  setBotInstance(bot);
  setTradeBotInstance(bot);
  setGuildBotInstance(bot);
  setOwnerBotInstance(bot);
  setTeamBotInstance(bot);
  setPaymentBotInstance(bot);

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

  // ─── Core ─────────────────────────────────────────────────────────────────
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

  // ─── Weapons ───────────────────────────────────────────────────────────────
  bot.command("equip", handleEquip);
  bot.command("weapons", handleEquip);
  bot.command("unequip", handleUnequip);
  bot.command("weaponshop", handleWeaponShop);
  bot.command("buyweapon", handleBuyWeapon);

  // ─── Shadows ───────────────────────────────────────────────────────────────
  bot.command("arise", handleExtract);
  bot.command("extract", handleExtract);
  bot.command("shadows", handleShadows);
  bot.command("army", handleShadows);

  // ─── Team ──────────────────────────────────────────────────────────────────
  bot.command("team", handleTeam);
  bot.command("summon", handleSummon);

  // ─── Guild ─────────────────────────────────────────────────────────────────
  bot.command("guild", handleGuild);
  bot.command("g", handleGuild);
  bot.command("createguild", async (ctx) => {
    const name = ctx.message?.text.split(" ").slice(1).join(" ") || "";
    await handleGuild({ ...ctx, message: { ...ctx.message, text: `/guild create ${name}` } } as typeof ctx);
  });

  // ─── PvP ───────────────────────────────────────────────────────────────────
  bot.command("arena", handlePvp);
  bot.command("pvp", handlePvp);
  bot.command("challenge", handlePvp);
  bot.command("pvplist", handlePvpList);

  // ─── Aura ──────────────────────────────────────────────────────────────────
  bot.command("aura", handleAura);
  bot.command("setaura", handleSetAura);
  bot.command("aurastore", handleAuraStore);
  bot.command("buyaura", handleBuyAura);

  // ─── Map ───────────────────────────────────────────────────────────────────
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

  // ─── Owner ────────────────────────────────────────────────────────────────
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

  // ─── Interactive Combat Callbacks ─────────────────────────────────────────
  bot.action(/^cm_(strike|power|shadow|guard|aura|noop)_(.+)$/, async (ctx) => {
    const move = (ctx.match as RegExpMatchArray)[1] as CombatMove | "noop";
    if (move === "noop") { await ctx.answerCbQuery("❌ Not enough MP for this move!", { show_alert: true }); return; }
    await handleCombatAction(ctx, move as CombatMove);
  });

  bot.action(/^cm_weapon_info_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const user = ctx.from;
    if (!user) return;
    const [hunter] = await db.select().from(huntersTable).where(eq(huntersTable.telegramId, String(user.id)));
    if (!hunter?.equippedWeapon) { await ctx.answerCbQuery("No weapon equipped.", { show_alert: true }); return; }
    await ctx.answerCbQuery(`🗡️ ${hunter.equippedWeapon} is active in this fight!`, { show_alert: true });
  });

  // ─── All Other Callbacks ──────────────────────────────────────────────────
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
  bot.action("action_equip", async (ctx) => { await ctx.answerCbQuery(); await handleEquip(ctx); });
  bot.action("action_weaponshop", async (ctx) => { await ctx.answerCbQuery(); await handleWeaponShop(ctx); });
  bot.action("action_help", async (ctx) => { await ctx.answerCbQuery(); await handleHelp(ctx); });
  bot.action("spin_buy", handleSpinBuyCallback);
  bot.action("team_create_prompt", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(`To create a team:\n<code>/team create [team name]</code>`);
  });

  // QR & Payment
  bot.action(/^qr_(\d+)$/, async (ctx) => {
    const amount = parseInt((ctx.match as RegExpMatchArray)[1], 10);
    await handleQrCallback(ctx, amount);
  });
  // Player: "I've Paid" — paid_notify_{amount}_{charName}
  bot.action(/^paid_notify_(\d+)_(.+)$/, async (ctx) => {
    const match = ctx.match as RegExpMatchArray;
    await handlePaidNotify(ctx, parseInt(match[1], 10), match[2]);
  });
  // Owner: Approve — pay_approve_{telegramId}|{amount}|{charName}
  bot.action(/^pay_approve_(.+)$/, async (ctx) => {
    await handleApprovePayment(ctx, (ctx.match as RegExpMatchArray)[1]);
  });
  // Owner: Reject — pay_reject_{telegramId}
  bot.action(/^pay_reject_(.+)$/, async (ctx) => {
    await handleRejectPayment(ctx, (ctx.match as RegExpMatchArray)[1]);
  });
  bot.action("action_payment", async (ctx) => { await ctx.answerCbQuery(); await handlePayment(ctx); });

  // Move
  bot.action(/^move_(.+)$/, async (ctx) => {
    await handleMoveCallback(ctx, (ctx.match as RegExpMatchArray)[1]);
  });

  // PvP
  bot.action(/^pvp_accept_(\d+)$/, async (ctx) => {
    await handlePvpAccept(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });
  bot.action(/^pvp_decline_(\d+)$/, async (ctx) => {
    await handlePvpDecline(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });
  bot.action(/^pvp_challenge_(\d+)_(\d+)$/, async (ctx) => {
    await handlePvpDirectChallenge(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10), parseInt((ctx.match as RegExpMatchArray)[2], 10));
  });

  // Trade
  bot.action(/^trade_accept_(\d+)$/, async (ctx) => {
    await handleTradeAccept(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });
  bot.action(/^trade_decline_(\d+)$/, async (ctx) => {
    await handleTradeDecline(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });

  // Premium
  bot.action(/^premium_buy_(.+)$/, async (ctx) => {
    await handlePremiumBuyCallback(ctx, (ctx.match as RegExpMatchArray)[1]);
  });
  bot.action(/^premium_view_(.+)$/, async (ctx) => {
    await handlePremiumView(ctx, (ctx.match as RegExpMatchArray)[1]);
  });

  // Guild
  bot.action(/^guild_join_(\d+)$/, async (ctx) => {
    await handleGuildJoinCallback(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });
  bot.action(/^guild_decline_(\d+)$/, handleGuildDeclineCallback);

  // Team
  bot.action(/^team_join_(\d+)$/, async (ctx) => {
    await handleTeamJoinCallback(ctx, parseInt((ctx.match as RegExpMatchArray)[1], 10));
  });
  bot.action(/^team_decline_(\d+)$/, handleTeamDeclineCallback);

  // Owner panel
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

  bot.launch({ allowedUpdates: ["message", "callback_query"], dropPendingUpdates: true });
  logger.info("Telegram bot started (long polling)");
  return bot;
}
