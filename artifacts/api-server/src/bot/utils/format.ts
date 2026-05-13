import { progressBar, RANK_EMOJIS, RANK_TITLES } from "./ranks";
import type { Hunter } from "@workspace/db";

export function systemBox(title: string, lines: string[]): string {
  return (
    `╔══════════════════════════╗\n` +
    `║  ${title.padEnd(24)}║\n` +
    `╚══════════════════════════╝\n\n` +
    lines.join("\n")
  );
}

export function systemAlert(message: string): string {
  return `⚠️ <b>[ SYSTEM ]</b>\n${message}`;
}

export function formatHunterProfile(hunter: Hunter): string {
  const rankEmoji = RANK_EMOJIS[hunter.rank] || "⬜";
  const rankTitle = RANK_TITLES[hunter.rank] || `${hunter.rank}-Rank Hunter`;
  const hpBar = progressBar(hunter.hp, hunter.maxHp, 12);
  const mpBar = progressBar(hunter.mp, hunter.maxMp, 12);
  const xpBar = progressBar(hunter.xp, hunter.xpToNextLevel, 12);
  const name = hunter.firstName || hunter.username || "Hunter";

  return (
    `🌑 <b>HUNTER PROFILE</b> 🌑\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>${name}</b>\n` +
    `${rankEmoji} <b>${rankTitle}</b>  |  Lv. <b>${hunter.level}</b>\n\n` +
    `❤️ HP: <b>${hunter.hp}/${hunter.maxHp}</b>\n` +
    `[${hpBar}]\n` +
    `💙 MP: <b>${hunter.mp}/${hunter.maxMp}</b>\n` +
    `[${mpBar}]\n` +
    `✨ XP: <b>${hunter.xp}/${hunter.xpToNextLevel}</b>\n` +
    `[${xpBar}]\n\n` +
    `━━━━━ STATS ━━━━━\n` +
    `⚔️ STR: <b>${hunter.strength}</b>   🏃 AGI: <b>${hunter.agility}</b>\n` +
    `🔮 INT: <b>${hunter.intelligence}</b>   👁️ PER: <b>${hunter.perception}</b>\n\n` +
    `💰 Gold: <b>${hunter.gold.toLocaleString()}</b>   🔑 Keys: <b>${hunter.dungeonKeys}</b>\n` +
    (hunter.statPoints > 0 ? `⭐ <b>STAT POINTS: ${hunter.statPoints}</b> (use /allocate)\n` : ``) +
    `\n━━━━━ RECORD ━━━━━\n` +
    `🏆 Wins: <b>${hunter.wins}</b>  💀 Losses: <b>${hunter.losses}</b>\n` +
    `🐾 Kills: <b>${hunter.monstersKilled}</b>  🏰 Dungeons: <b>${hunter.dungeonsCleared}</b>`
  );
}

export function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const SOLO_LEVELING_IMAGES = {
  welcome:
    "https://i.imgur.com/5q5ZQ5v.jpeg",
  profile:
    "https://i.imgur.com/Q5oVg9u.jpeg",
  hunt:
    "https://i.imgur.com/9R5SXNK.jpeg",
  dungeonGate:
    "https://i.imgur.com/bVptqOM.jpeg",
  victory:
    "https://i.imgur.com/3z3z3z3.jpeg",
  rankUp:
    "https://i.imgur.com/fXGzmNs.jpeg",
  shop:
    "https://i.imgur.com/YwD8XjW.jpeg",
  daily:
    "https://i.imgur.com/Lz3zL3z.jpeg",
};
