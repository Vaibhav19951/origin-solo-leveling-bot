export interface PremiumCharacter {
  id: string;
  name: string;
  title: string;
  rank: string;
  description: string;
  emoji: string;
  priceManaCoin: number;
  priceINR: number;
  strBonus: number;
  agiBonus: number;
  intBonus: number;
  perBonus: number;
  maxHpBonus: number;
  xpMultiplier: number; // 1.0 = no bonus
  goldMultiplier: number;
  specialAbility: string;
  imageUrl: string;
  rarity: "Legendary" | "Mythic" | "Divine";
}

export const PREMIUM_CHARACTERS: PremiumCharacter[] = [
  {
    id: "sung_jin_woo",
    name: "Sung Jin-Woo",
    title: "Shadow Monarch",
    rank: "Monarch",
    description: "The only human to ever become a Monarch. Chosen by the System itself. His power knows no limits.",
    emoji: "👑",
    priceManaCoin: 49900,
    priceINR: 499,
    strBonus: 300,
    agiBonus: 250,
    intBonus: 150,
    perBonus: 200,
    maxHpBonus: 2000,
    xpMultiplier: 2.0,
    goldMultiplier: 1.5,
    specialAbility: "⚫ ARISE — Can extract shadow soldiers (+50% XP from all battles)",
    imageUrl: "https://i.imgur.com/5q5ZQ5v.jpeg",
    rarity: "Divine",
  },
  {
    id: "thomas_andre",
    name: "Thomas Andre",
    title: "Goliath of the North",
    rank: "NLH",
    description: "The world's strongest National Level Hunter from America. His durability is unmatched.",
    emoji: "⚡",
    priceManaCoin: 39900,
    priceINR: 399,
    strBonus: 250,
    agiBonus: 100,
    intBonus: 80,
    perBonus: 100,
    maxHpBonus: 3000,
    xpMultiplier: 1.7,
    goldMultiplier: 1.4,
    specialAbility: "🛡️ IRON BODY — Takes 30% less damage in all combat",
    imageUrl: "https://i.imgur.com/Q5oVg9u.jpeg",
    rarity: "Mythic",
  },
  {
    id: "go_gunhee",
    name: "Go Gun-Hee",
    title: "Chairman of the Korean Hunter Association",
    rank: "NLH",
    description: "The legendary chairman who guided Korea through the Hunter era. A master tactician.",
    emoji: "🌟",
    priceManaCoin: 29900,
    priceINR: 299,
    strBonus: 180,
    agiBonus: 140,
    intBonus: 220,
    perBonus: 250,
    maxHpBonus: 1500,
    xpMultiplier: 1.6,
    goldMultiplier: 1.6,
    specialAbility: "📋 COMMANDER — +60% Gold & Mana Coin rewards from all sources",
    imageUrl: "https://i.imgur.com/9R5SXNK.jpeg",
    rarity: "Mythic",
  },
  {
    id: "cha_haein",
    name: "Cha Hae-In",
    title: "Korea's Top Female Hunter",
    rank: "S",
    description: "The vice-guildmaster of the Hunters Guild. Her sword technique is unparalleled.",
    emoji: "⚔️",
    priceManaCoin: 24900,
    priceINR: 249,
    strBonus: 200,
    agiBonus: 220,
    intBonus: 100,
    perBonus: 180,
    maxHpBonus: 1200,
    xpMultiplier: 1.5,
    goldMultiplier: 1.3,
    specialAbility: "🗡️ DIVINE SWORD — Critical hit chance +40% in all battles",
    imageUrl: "https://i.imgur.com/bVptqOM.jpeg",
    rarity: "Legendary",
  },
  {
    id: "choi_jongin",
    name: "Choi Jong-In",
    title: "Korea's Flame Mage",
    rank: "S",
    description: "The Guild Master of the Hunters Guild. Master of fire magic with destructive power.",
    emoji: "🔥",
    priceManaCoin: 19900,
    priceINR: 199,
    strBonus: 120,
    agiBonus: 140,
    intBonus: 280,
    perBonus: 150,
    maxHpBonus: 1000,
    xpMultiplier: 1.4,
    goldMultiplier: 1.3,
    specialAbility: "🔥 INFERNO — Magic attacks deal +60% damage to monsters",
    imageUrl: "https://i.imgur.com/YwD8XjW.jpeg",
    rarity: "Legendary",
  },
  {
    id: "baek_yoonho",
    name: "Baek Yoon-Ho",
    title: "White Tiger Guild Master",
    rank: "S",
    description: "The powerful guild master who transforms into a giant white tiger in battle.",
    emoji: "🐯",
    priceManaCoin: 14900,
    priceINR: 149,
    strBonus: 230,
    agiBonus: 200,
    intBonus: 60,
    perBonus: 120,
    maxHpBonus: 1800,
    xpMultiplier: 1.35,
    goldMultiplier: 1.25,
    specialAbility: "🐯 WHITE TIGER FORM — +35% STR & AGI in combat",
    imageUrl: "https://i.imgur.com/fXGzmNs.jpeg",
    rarity: "Legendary",
  },
];

export const RARITY_EMOJI: Record<string, string> = {
  Divine: "✨",
  Mythic: "💜",
  Legendary: "🌟",
};

export const RARITY_PRICE_LABEL: Record<string, string> = {
  Divine: "DIVINE",
  Mythic: "MYTHIC",
  Legendary: "LEGENDARY",
};
