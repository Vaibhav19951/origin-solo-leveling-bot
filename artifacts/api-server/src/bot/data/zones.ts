export interface Zone {
  name: string;
  emoji: string;
  minRank: string;
  description: string;
  danger: string;
  mapSymbol: string;
}

export const ZONES: Zone[] = [
  {
    name: "Cartenon Temple",
    emoji: "🏛️",
    minRank: "E",
    description: "Ancient temple ruins. Safe for new hunters.",
    danger: "Low",
    mapSymbol: "🏛️",
  },
  {
    name: "Demons Castle",
    emoji: "🏰",
    minRank: "D",
    description: "A haunted fortress overrun by demon-class monsters.",
    danger: "Moderate",
    mapSymbol: "🏰",
  },
  {
    name: "Jeju Island",
    emoji: "🌴",
    minRank: "C",
    description: "Once a tourist paradise, now overrun by ant-type monsters.",
    danger: "High",
    mapSymbol: "🌴",
  },
  {
    name: "Red Gate",
    emoji: "🔴",
    minRank: "B",
    description: "A one-way gate. Hunters who enter cannot leave until cleared.",
    danger: "Extreme",
    mapSymbol: "🔴",
  },
  {
    name: "Abyss Gate",
    emoji: "🌑",
    minRank: "A",
    description: "The threshold between the human world and the abyss.",
    danger: "Critical",
    mapSymbol: "🌑",
  },
  {
    name: "Shadow Realm",
    emoji: "👑",
    minRank: "S",
    description: "The domain of the Shadow Monarch. Only the strongest dare enter.",
    danger: "MONARCH",
    mapSymbol: "👑",
  },
];

export const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "NLH", "Monarch"];

export function getZonesForRank(rank: string): Zone[] {
  const idx = RANK_ORDER.indexOf(rank === "NLH" || rank === "Monarch" ? "S" : rank);
  return ZONES.filter((z) => {
    const zIdx = RANK_ORDER.indexOf(z.minRank);
    return zIdx <= idx;
  });
}

export function getZone(name: string): Zone | undefined {
  return ZONES.find((z) => z.name.toLowerCase() === name.toLowerCase() ||
    z.name.toLowerCase().includes(name.toLowerCase()));
}
