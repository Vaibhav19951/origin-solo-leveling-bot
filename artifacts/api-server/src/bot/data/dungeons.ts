export interface Dungeon {
  name: string;
  rank: string;
  description: string;
  bossName: string;
  bossHp: number;
  bossStrength: number;
  xpReward: number;
  goldReward: number;
  keyCost: number;
  emoji: string;
  waves: number;
  imageCaption: string;
}

export const DUNGEONS: Dungeon[] = [
  {
    name: "Ant Nest",
    rank: "E",
    description: "An underground labyrinth swarming with giant ants.",
    bossName: "Ant Queen",
    bossHp: 300,
    bossStrength: 20,
    xpReward: 200,
    goldReward: 150,
    keyCost: 1,
    emoji: "🐜",
    waves: 2,
    imageCaption: "You descend into the darkness of the Ant Nest Gate...",
  },
  {
    name: "Goblin Fortress",
    rank: "D",
    description: "A fortified goblin stronghold teeming with armed warriors.",
    bossName: "Goblin Warlord",
    bossHp: 700,
    bossStrength: 50,
    xpReward: 600,
    goldReward: 400,
    keyCost: 1,
    emoji: "🏰",
    waves: 3,
    imageCaption: "The gate pulses with ominous mana. The Goblin Fortress awaits.",
  },
  {
    name: "Orc Citadel",
    rank: "C",
    description: "A massive dungeon ruled by an iron-fisted orc warlord.",
    bossName: "Iron Orc King",
    bossHp: 1500,
    bossStrength: 90,
    xpReward: 1200,
    goldReward: 800,
    keyCost: 1,
    emoji: "⚔️",
    waves: 3,
    imageCaption: "Entering the Orc Citadel. Mana concentration: extreme.",
  },
  {
    name: "Frost Dungeon",
    rank: "B",
    description: "A frozen dungeon where temperature drops below survival thresholds.",
    bossName: "Frost Lord Ragnar",
    bossHp: 3000,
    bossStrength: 150,
    xpReward: 2500,
    goldReward: 1600,
    keyCost: 1,
    emoji: "❄️",
    waves: 4,
    imageCaption: "The Frost Dungeon Gate — even the air inside can kill.",
  },
  {
    name: "Demon's Domain",
    rank: "A",
    description: "A red-gate dungeon overflowing with demonic mana.",
    bossName: "Grand Demon Belial",
    bossHp: 6000,
    bossStrength: 250,
    xpReward: 5000,
    goldReward: 3000,
    keyCost: 1,
    emoji: "😈",
    waves: 4,
    imageCaption: "A red gate. No survivors have ever returned alone.",
  },
  {
    name: "Abyss Gate",
    rank: "S",
    description: "The highest-ranked dungeon. Only the world's strongest hunters dare enter.",
    bossName: "Shadow Monarch's Remnant",
    bossHp: 15000,
    bossStrength: 450,
    xpReward: 12000,
    goldReward: 8000,
    keyCost: 1,
    emoji: "🌑",
    waves: 5,
    imageCaption: "THE ABYSS GATE. Mana reading: CRITICAL. Rank: S. Proceed with extreme caution.",
  },
];

export function getDungeonsForRank(rank: string): Dungeon[] {
  const rankOrder = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];
  const idx = rankOrder.indexOf(rank);
  const rankMap: Record<string, string> = {
    NLH: "S",
    Monarch: "S",
  };
  const effectiveRank = rankMap[rank] || rank;
  const effectiveIdx = rankOrder.indexOf(effectiveRank);

  return DUNGEONS.filter((d) => {
    const dIdx = rankOrder.indexOf(d.rank);
    return dIdx <= effectiveIdx;
  });
}

export function getDefaultDungeon(rank: string): Dungeon {
  const available = getDungeonsForRank(rank);
  return available[available.length - 1];
}
