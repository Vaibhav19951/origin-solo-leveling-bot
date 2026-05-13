export interface Monster {
  name: string;
  rank: string;
  hp: number;
  strength: number;
  xpReward: number;
  goldReward: number;
  description: string;
  emoji: string;
  dropChance: number; // 0-1
  possibleDrops: string[]; // item names
}

export const MONSTERS: Monster[] = [
  // E Rank Monsters
  {
    name: "Giant Ant",
    rank: "E",
    hp: 60,
    strength: 8,
    xpReward: 30,
    goldReward: 20,
    description: "A monstrous ant from the lower gates. Weak but numerous.",
    emoji: "🐜",
    dropChance: 0.1,
    possibleDrops: ["Small HP Potion"],
  },
  {
    name: "Slime",
    rank: "E",
    hp: 40,
    strength: 5,
    xpReward: 20,
    goldReward: 15,
    description: "A gelatinous creature that dissolves organic matter.",
    emoji: "🟢",
    dropChance: 0.08,
    possibleDrops: ["Small HP Potion"],
  },
  {
    name: "Goblin Scout",
    rank: "E",
    hp: 80,
    strength: 12,
    xpReward: 45,
    goldReward: 30,
    description: "A cunning goblin that scouts enemy territory.",
    emoji: "👺",
    dropChance: 0.15,
    possibleDrops: ["Small HP Potion", "Hunter's Dagger"],
  },
  {
    name: "Dire Rat",
    rank: "E",
    hp: 50,
    strength: 7,
    xpReward: 25,
    goldReward: 18,
    description: "An oversized rat with razor-sharp teeth.",
    emoji: "🐀",
    dropChance: 0.08,
    possibleDrops: ["Small HP Potion"],
  },

  // D Rank Monsters
  {
    name: "Dire Wolf",
    rank: "D",
    hp: 180,
    strength: 28,
    xpReward: 120,
    goldReward: 80,
    description: "A massive wolf from the dungeon forests. Hunts in packs.",
    emoji: "🐺",
    dropChance: 0.2,
    possibleDrops: ["Medium HP Potion", "Hunter's Dagger"],
  },
  {
    name: "Orc Warrior",
    rank: "D",
    hp: 220,
    strength: 35,
    xpReward: 150,
    goldReward: 100,
    description: "A brutish orc armed with crude iron weapons.",
    emoji: "👹",
    dropChance: 0.22,
    possibleDrops: ["Medium HP Potion", "Knight's Sword"],
  },
  {
    name: "Giant Lizard",
    rank: "D",
    hp: 200,
    strength: 30,
    xpReward: 130,
    goldReward: 90,
    description: "A scaly beast with a venomous bite.",
    emoji: "🦎",
    dropChance: 0.18,
    possibleDrops: ["Medium HP Potion", "Small MP Potion"],
  },
  {
    name: "Stone Golem",
    rank: "D",
    hp: 300,
    strength: 25,
    xpReward: 160,
    goldReward: 110,
    description: "An animated construct of living rock. Slow but devastating.",
    emoji: "🪨",
    dropChance: 0.2,
    possibleDrops: ["Medium HP Potion"],
  },

  // C Rank Monsters
  {
    name: "Orc Lord",
    rank: "C",
    hp: 500,
    strength: 60,
    xpReward: 350,
    goldReward: 250,
    description: "Leader of an orc clan. Commands fear from lesser monsters.",
    emoji: "⚔️",
    dropChance: 0.3,
    possibleDrops: ["Large HP Potion", "Knight's Sword", "Medium MP Potion"],
  },
  {
    name: "Cyclops",
    rank: "C",
    hp: 600,
    strength: 70,
    xpReward: 400,
    goldReward: 280,
    description: "A one-eyed giant with crushing strength.",
    emoji: "👁️",
    dropChance: 0.28,
    possibleDrops: ["Large HP Potion", "Steel Armor"],
  },
  {
    name: "Basilisk",
    rank: "C",
    hp: 450,
    strength: 55,
    xpReward: 320,
    goldReward: 230,
    description: "A serpent whose gaze can paralyze hunters.",
    emoji: "🐍",
    dropChance: 0.3,
    possibleDrops: ["Large HP Potion", "Medium MP Potion"],
  },

  // B Rank Monsters
  {
    name: "Ogre Berserker",
    rank: "B",
    hp: 1000,
    strength: 110,
    xpReward: 700,
    goldReward: 500,
    description: "A raging ogre lost to bloodlust. Nearly impossible to stop.",
    emoji: "👊",
    dropChance: 0.35,
    possibleDrops: ["Large HP Potion", "Demon's Blade", "Shadow Armor"],
  },
  {
    name: "Ice Troll",
    rank: "B",
    hp: 900,
    strength: 100,
    xpReward: 650,
    goldReward: 460,
    description: "A massive troll that regenerates in cold environments.",
    emoji: "❄️",
    dropChance: 0.35,
    possibleDrops: ["Large HP Potion", "Shadow Armor", "Large MP Potion"],
  },
  {
    name: "Werewolf Alpha",
    rank: "B",
    hp: 850,
    strength: 120,
    xpReward: 720,
    goldReward: 520,
    description: "The alpha of a werewolf pack. Speed and savagery combined.",
    emoji: "🌕",
    dropChance: 0.38,
    possibleDrops: ["Demon's Blade", "Large HP Potion"],
  },

  // A Rank Monsters
  {
    name: "Frost Giant",
    rank: "A",
    hp: 2000,
    strength: 200,
    xpReward: 1500,
    goldReward: 1000,
    description: "An ancient giant from the frozen abyss. A calamity-class threat.",
    emoji: "🏔️",
    dropChance: 0.4,
    possibleDrops: ["Shadow Armor", "Demon's Blade", "Large HP Potion"],
  },
  {
    name: "Chimera",
    rank: "A",
    hp: 1800,
    strength: 180,
    xpReward: 1400,
    goldReward: 950,
    description: "A grotesque hybrid of lion, goat, and serpent. Lethal in all forms.",
    emoji: "🦁",
    dropChance: 0.4,
    possibleDrops: ["Shadow Armor", "Large MP Potion", "Demon's Blade"],
  },
  {
    name: "Demon Lord Baran",
    rank: "A",
    hp: 2200,
    strength: 220,
    xpReward: 1800,
    goldReward: 1200,
    description: "An ancient demon lord who commands lightning. One of the Ruler's army.",
    emoji: "⚡",
    dropChance: 0.45,
    possibleDrops: ["Demon's Blade", "Shadow Armor"],
  },

  // S Rank Monsters
  {
    name: "Cerberus",
    rank: "S",
    hp: 5000,
    strength: 350,
    xpReward: 4000,
    goldReward: 2500,
    description: "The three-headed guardian of the abyss. A national-level threat.",
    emoji: "🐕",
    dropChance: 0.5,
    possibleDrops: ["Shadow Armor", "Demon's Blade"],
  },
  {
    name: "Hydra",
    rank: "S",
    hp: 6000,
    strength: 300,
    xpReward: 4500,
    goldReward: 3000,
    description: "A multi-headed serpent that regenerates severed heads in combat.",
    emoji: "🐲",
    dropChance: 0.5,
    possibleDrops: ["Shadow Armor", "Demon's Blade"],
  },
  {
    name: "Kamish the Dragon",
    rank: "S",
    hp: 10000,
    strength: 500,
    xpReward: 8000,
    goldReward: 5000,
    description: "The most powerful dragon ever recorded. Destroyed a city in hours. Only the world's greatest hunters can face it.",
    emoji: "🐉",
    dropChance: 0.6,
    possibleDrops: ["Demon's Blade"],
  },
];

export function getMonstersForRank(rank: string): Monster[] {
  const rankOrder = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];
  const idx = rankOrder.indexOf(rank);

  const validRanks: string[] = [];
  // Can fight monsters at own rank and one below
  if (idx > 0) validRanks.push(rankOrder[idx - 1]);
  validRanks.push(rank);
  // Small chance to fight higher rank
  if (idx < rankOrder.length - 1) validRanks.push(rankOrder[idx + 1]);

  const normalized = rank === "NLH" || rank === "Monarch" ? "S" : rank;
  const candidates = MONSTERS.filter((m) => {
    const mNorm = m.rank;
    return validRanks.includes(mNorm) || mNorm === normalized;
  });

  if (candidates.length === 0) return MONSTERS.filter((m) => m.rank === "S");
  return candidates;
}

export function pickMonster(rank: string): Monster {
  const pool = getMonstersForRank(rank);
  return pool[Math.floor(Math.random() * pool.length)];
}
