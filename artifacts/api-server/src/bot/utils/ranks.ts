export const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

export const RANK_EMOJIS: Record<string, string> = {
  E: "⬜",
  D: "🟩",
  C: "🟦",
  B: "🟪",
  A: "🟧",
  S: "🟥",
  NLH: "⭐",
  Monarch: "👑",
};

export const RANK_TITLES: Record<string, string> = {
  E: "E-Rank Hunter",
  D: "D-Rank Hunter",
  C: "C-Rank Hunter",
  B: "B-Rank Hunter",
  A: "A-Rank Hunter",
  S: "S-Rank Hunter",
  NLH: "National Level Hunter",
  Monarch: "Shadow Monarch",
};

// Level thresholds for rank promotions
export const RANK_PROMOTION_LEVELS: Record<string, number> = {
  D: 11,
  C: 21,
  B: 31,
  A: 46,
  S: 61,
  NLH: 76,
  Monarch: 91,
};

export function getRankForLevel(level: number): string {
  if (level >= 91) return "Monarch";
  if (level >= 76) return "NLH";
  if (level >= 61) return "S";
  if (level >= 46) return "A";
  if (level >= 31) return "B";
  if (level >= 21) return "C";
  if (level >= 11) return "D";
  return "E";
}

export function getXpForLevel(level: number): number {
  if (level <= 10) return level * 100;
  if (level <= 30) return 1000 + (level - 10) * 200;
  if (level <= 50) return 5000 + (level - 30) * 500;
  if (level <= 70) return 15000 + (level - 50) * 1000;
  if (level <= 90) return 35000 + (level - 70) * 2000;
  return 75000 + (level - 90) * 5000;
}

export function getBaseStatsForLevel(level: number) {
  const base = {
    maxHp: 100 + level * 20,
    maxMp: 50 + level * 10,
    strength: 10 + level * 3,
    agility: 8 + level * 2,
    intelligence: 6 + level * 2,
    perception: 7 + level * 2,
  };
  return base;
}

export function progressBar(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, empty));
}

export function getRankUpMessage(newRank: string): string {
  const msgs: Record<string, string> = {
    D: `⚡ <b>RANK PROMOTION!</b>\nYou have been evaluated by the System.\n\n<b>New Rank: D ⚡</b>\n\nYour power grows. The gates fear you now.`,
    C: `💙 <b>RANK PROMOTION!</b>\nThe Association has updated your status.\n\n<b>New Rank: C 💙</b>\n\nYou stand above ordinary hunters. Keep climbing.`,
    B: `🟪 <b>RANK PROMOTION!</b>\nYour mana signature has been re-evaluated.\n\n<b>New Rank: B 🟪</b>\n\nYou are now considered elite. The real battles begin.`,
    A: `🟧 <b>RANK PROMOTION!</b>\nYou have reached the realm of the exceptional.\n\n<b>New Rank: A 🟧</b>\n\nFew hunters ever reach this point. You are dangerous.`,
    S: `🟥 <b>⚠ RANK PROMOTION — S CLASS! ⚠</b>\nCongratulations, Hunter.\nYou have achieved what less than 0.001% of mankind ever will.\n\n<b>New Rank: S 🟥</b>\n\nYou are now one of the world's strongest. The Monarchs take notice.`,
    NLH: `⭐ <b>⚠ NATIONAL LEVEL HUNTER! ⚠</b>\nYou have transcended ordinary S-Rank.\nGovernments know your name.\n\n<b>New Rank: National Level Hunter ⭐</b>\n\nYou are a living weapon. A nation's last line of defense.`,
    Monarch: `👑 <b>🌑 ARISE — SHADOW MONARCH 🌑</b>\nThe System acknowledges you as its master.\nYou stand at the apex of all existence.\n\n<b>New Rank: SHADOW MONARCH 👑</b>\n\n<i>"I alone level up."</i>\n— Sung Jin-Woo`,
  };
  return msgs[newRank] || `🎊 Rank promoted to ${newRank}!`;
}
