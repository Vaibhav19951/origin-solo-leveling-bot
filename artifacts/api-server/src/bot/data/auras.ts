export interface Aura {
  id: string;
  name: string;
  emoji: string;
  description: string;
  costMC: number;
  rankRequired: string;
  bonusStr?: number;
  bonusAgi?: number;
  bonusInt?: number;
  bonusHp?: number;
  xpBonus?: number; // percentage
}

const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

export const AURAS: Aura[] = [
  {
    id: "hunter",
    name: "Hunter's Aura",
    emoji: "⬜",
    description: "The basic aura of a registered hunter.",
    costMC: 0,
    rankRequired: "E",
  },
  {
    id: "emerald",
    name: "Emerald Aura",
    emoji: "💚",
    description: "A protective forest aura. Increases max HP.",
    costMC: 200,
    rankRequired: "D",
    bonusHp: 150,
  },
  {
    id: "flame",
    name: "Flame Aura",
    emoji: "🔥",
    description: "Blazing fire aura of a warrior. Boosts STR.",
    costMC: 400,
    rankRequired: "C",
    bonusStr: 8,
  },
  {
    id: "ice",
    name: "Frost Aura",
    emoji: "❄️",
    description: "Freezing aura that sharpens the mind. Boosts INT.",
    costMC: 400,
    rankRequired: "C",
    bonusInt: 8,
  },
  {
    id: "lightning",
    name: "Lightning Aura",
    emoji: "⚡",
    description: "Electric storm aura of speed. Boosts AGI.",
    costMC: 500,
    rankRequired: "B",
    bonusAgi: 12,
  },
  {
    id: "crimson",
    name: "Crimson Aura",
    emoji: "🩸",
    description: "Blood-soaked aura of relentless war. High STR bonus.",
    costMC: 800,
    rankRequired: "B",
    bonusStr: 15,
  },
  {
    id: "divine",
    name: "Divine Aura",
    emoji: "✨",
    description: "Holy radiance of the gods. Boosts HP & XP gain.",
    costMC: 1000,
    rankRequired: "A",
    bonusHp: 400,
    xpBonus: 10,
  },
  {
    id: "void",
    name: "Void Aura",
    emoji: "🕳️",
    description: "Aura of nothingness. Massive INT boost.",
    costMC: 1500,
    rankRequired: "S",
    bonusInt: 25,
  },
  {
    id: "golden",
    name: "Golden Aura",
    emoji: "🌟",
    description: "Aura of champions. All-round stat boost.",
    costMC: 2000,
    rankRequired: "S",
    bonusStr: 10,
    bonusAgi: 10,
    bonusInt: 10,
    bonusHp: 300,
  },
  {
    id: "shadow",
    name: "Shadow Monarch Aura",
    emoji: "🌑",
    description: "The aura of the Shadow Monarch himself. Ultimate power.",
    costMC: 5000,
    rankRequired: "S",
    bonusStr: 30,
    bonusAgi: 20,
    bonusInt: 20,
    bonusHp: 1000,
    xpBonus: 20,
  },
  {
    id: "monarch",
    name: "Absolute Aura",
    emoji: "👑",
    description: "Aura reserved for those who stand above all else.",
    costMC: 10000,
    rankRequired: "Monarch",
    bonusStr: 100,
    bonusAgi: 80,
    bonusInt: 80,
    bonusHp: 5000,
    xpBonus: 50,
  },
];

export function getAuraById(id: string): Aura | undefined {
  return AURAS.find((a) => a.id === id);
}

export function canUnlockAura(hunterRank: string, aura: Aura): boolean {
  const hunterIdx = RANK_ORDER.indexOf(hunterRank === "NLH" ? "NLH" : hunterRank);
  const auraIdx = RANK_ORDER.indexOf(aura.rankRequired);
  return hunterIdx >= auraIdx;
}

export function getAuraDisplay(aura: Aura | undefined): string {
  if (!aura || aura.id === "none") return "⬜ None";
  return `${aura.emoji} ${aura.name}`;
}
