export interface WeaponDef {
  name: string;
  emoji: string;
  type: "sword" | "dagger" | "staff" | "bow" | "scythe" | "gauntlet" | "spear";
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  atkBonus: number;
  agiBonus: number;
  intBonus: number;
  maxHpBonus: number;
  price: number;      // gold cost (0 = not in shop)
  pricemc: number;    // mana coin cost (0 = not in MC shop)
  rankRequired: string;
  description: string;
  special?: string;   // special effect description
}

export const WEAPONS: WeaponDef[] = [
  // ── Common / Shop Weapons ─────────────────────────────────────────────────
  {
    name: "Iron Sword",
    emoji: "🗡️",
    type: "sword",
    rarity: "common",
    atkBonus: 15, agiBonus: 0, intBonus: 0, maxHpBonus: 0,
    price: 500, pricemc: 0,
    rankRequired: "E",
    description: "A sturdy iron sword used by rookies.",
  },
  {
    name: "Hunter's Bow",
    emoji: "🏹",
    type: "bow",
    rarity: "common",
    atkBonus: 12, agiBonus: 10, intBonus: 0, maxHpBonus: 0,
    price: 800, pricemc: 0,
    rankRequired: "E",
    description: "A light bow for agile hunters. Strikes before the monster.",
    special: "First Strike",
  },
  {
    name: "Steel Blade",
    emoji: "⚔️",
    type: "sword",
    rarity: "rare",
    atkBonus: 30, agiBonus: 0, intBonus: 0, maxHpBonus: 50,
    price: 2000, pricemc: 0,
    rankRequired: "D",
    description: "A refined steel sword forged by a master blacksmith.",
  },
  {
    name: "Mage's Staff",
    emoji: "🪄",
    type: "staff",
    rarity: "rare",
    atkBonus: 10, agiBonus: 0, intBonus: 25, maxHpBonus: 0,
    price: 2500, pricemc: 0,
    rankRequired: "D",
    description: "Amplifies magical attacks. Boosts INT-based moves.",
    special: "Magic Amp",
  },
  {
    name: "Shadow Dagger",
    emoji: "🌑",
    type: "dagger",
    rarity: "epic",
    atkBonus: 45, agiBonus: 15, intBonus: 0, maxHpBonus: 0,
    price: 5000, pricemc: 0,
    rankRequired: "C",
    description: "A blade that strikes twice per round.",
    special: "Double Strike",
  },
  {
    name: "Rune Spear",
    emoji: "🔱",
    type: "spear",
    rarity: "epic",
    atkBonus: 55, agiBonus: 0, intBonus: 10, maxHpBonus: 100,
    price: 8000, pricemc: 0,
    rankRequired: "B",
    description: "A runic spear that pierces defenses.",
  },

  // ── Premium Weapons (Mana Coins) ─────────────────────────────────────────
  {
    name: "Demon's Edge",
    emoji: "😈",
    type: "sword",
    rarity: "legendary",
    atkBonus: 90, agiBonus: 10, intBonus: 0, maxHpBonus: 0,
    price: 0, pricemc: 800,
    rankRequired: "B",
    description: "A blade carved from a demon's fang. Lifesteal on every hit.",
    special: "Lifesteal",
  },
  {
    name: "Holy Spear",
    emoji: "✨",
    type: "spear",
    rarity: "legendary",
    atkBonus: 75, agiBonus: 0, intBonus: 20, maxHpBonus: 300,
    price: 0, pricemc: 1000,
    rankRequired: "A",
    description: "A divine weapon that deals extra damage to high-rank monsters.",
    special: "Holy Smite",
  },
  {
    name: "Berserk Gauntlets",
    emoji: "🥊",
    type: "gauntlet",
    rarity: "legendary",
    atkBonus: 70, agiBonus: 20, intBonus: 0, maxHpBonus: 0,
    price: 0, pricemc: 1200,
    rankRequired: "A",
    description: "Raw power amplified. Deals double damage below 30% HP.",
    special: "Berserker",
  },
  {
    name: "Shadow Monarch's Sword",
    emoji: "👑",
    type: "scythe",
    rarity: "mythic",
    atkBonus: 200, agiBonus: 30, intBonus: 30, maxHpBonus: 500,
    price: 0, pricemc: 5000,
    rankRequired: "S",
    description: "The legendary blade of the Shadow Monarch. Destroys all who oppose.",
    special: "Monarch's Decree",
  },
];

export function getWeaponByName(name: string): WeaponDef | undefined {
  return WEAPONS.find((w) => w.name.toLowerCase() === name.toLowerCase());
}

export const WEAPON_RARITY_EMOJIS: Record<string, string> = {
  common: "⬜",
  rare: "🟦",
  epic: "🟣",
  legendary: "🟡",
  mythic: "🔴",
};
