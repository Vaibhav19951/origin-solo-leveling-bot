import type { Hunter } from "@workspace/db";
import type { Monster } from "../data/monsters";
import type { Aura } from "../data/auras";
import type { WeaponDef } from "../data/weapons";

export type CombatMove =
  | "strike"
  | "power"
  | "shadow"
  | "guard"
  | "aura";

export interface CombatSession {
  telegramId: string;
  hunterId: number;
  monster: Monster;
  hunterHp: number;
  hunterMp: number;
  hunterMaxHp: number;
  hunterMaxMp: number;
  monsterHp: number;
  monsterMaxHp: number;
  baseHunterAtk: number;
  baseMonsterAtk: number;
  weapon: WeaponDef | null;
  aura: Aura | null;
  shadowCount: number;
  shadowBonusAtk: number;
  xpReward: number;
  goldReward: number;
  manaCoinGain: number;
  round: number;
  burnDmgPerRound: number;
  frozenRoundsLeft: number;
  log: string[];
  expiresAt: number;
}

export const combatSessions = new Map<string, CombatSession>();

export interface RoundResult {
  ended: boolean;
  won: boolean;
  roundLog: string[];
  damageDealt: number;
  damageTaken: number;
}

function rand(base: number, variance = 0.2): number {
  return Math.max(1, Math.floor(base * (1 - variance / 2 + Math.random() * variance)));
}

export function getAuraMoveLabel(aura: Aura | null): string {
  if (!aura || aura.id === "none" || aura.id === "hunter") return "✨ Aura Burst";
  const labels: Record<string, string> = {
    emerald: "💚 Nature Shield",
    flame: "🔥 Burning Strike",
    ice: "❄️ Frost Nova",
    lightning: "⚡ Lightning Bolt",
    crimson: "🩸 Berserker Rage",
    divine: "✨ Holy Smite",
    void: "🕳️ Void Collapse",
    golden: "🌟 Golden Strike",
    shadow: "🌑 Shadow Wrath",
    monarch: "👑 Absolute Power",
  };
  return labels[aura.id] || "✨ Aura Burst";
}

export function canAuraBurst(aura: Aura | null): boolean {
  return !!(aura && aura.id !== "none" && aura.id !== "hunter");
}

export function canShadowSlash(shadowCount: number, mp: number): boolean {
  return shadowCount > 0 && mp >= 50;
}

export function processRound(session: CombatSession, move: CombatMove): RoundResult {
  const log: string[] = [];
  let damageDealt = 0;
  let damageTaken = 0;

  session.round++;
  const isLow = session.hunterHp / session.hunterMaxHp <= 0.3;

  // ── Hunter attacks ────────────────────────────────────────────────────────
  let atkMultiplier = 1;
  let mpCost = 0;
  let specialMsg = "";
  let skipMonsterAttack = false;
  let healAmount = 0;

  switch (move) {
    case "strike": {
      // Dagger: double strike
      if (session.weapon?.special === "Double Strike") {
        const hit1 = rand(session.baseHunterAtk);
        const hit2 = rand(session.baseHunterAtk * 0.7);
        damageDealt = hit1 + hit2;
        specialMsg = `🌑 <b>Double Strike!</b> ${hit1} + ${hit2} = <b>${damageDealt}</b> dmg!`;
      } else {
        damageDealt = rand(session.baseHunterAtk);
        // Bow: attack first (monster attacks at 50% power this round)
        if (session.weapon?.special === "First Strike") {
          damageTaken = rand(session.baseMonsterAtk * 0.5);
          specialMsg = `🏹 <b>First Strike!</b> You attack before the monster!`;
          skipMonsterAttack = true;
        }
      }
      break;
    }
    case "power": {
      atkMultiplier = 1.5;
      mpCost = 25;
      damageDealt = rand(session.baseHunterAtk * atkMultiplier);
      specialMsg = `💥 <b>Power Strike!</b> Charged attack!`;
      break;
    }
    case "shadow": {
      atkMultiplier = 2.0;
      mpCost = 50;
      damageDealt = rand(session.baseHunterAtk * atkMultiplier * (1 + session.shadowCount * 0.05));
      specialMsg = `🌑 <b>Shadow Slash!</b> Your ${session.shadowCount} shadows strike as one!`;
      break;
    }
    case "guard": {
      damageDealt = rand(session.baseHunterAtk * 0.3);
      damageTaken = rand(session.baseMonsterAtk * 0.3);
      skipMonsterAttack = true;
      specialMsg = `🛡️ <b>Guard!</b> You brace for impact, dealing a glancing blow.`;
      break;
    }
    case "aura": {
      const aura = session.aura;
      mpCost = 40;
      if (!aura || aura.id === "none" || aura.id === "hunter") {
        damageDealt = rand(session.baseHunterAtk * 1.2);
        specialMsg = `✨ Weak aura pulse.`;
      } else {
        switch (aura.id) {
          case "emerald":
            damageDealt = rand(session.baseHunterAtk * 0.8);
            healAmount = Math.min(60, session.hunterMaxHp - session.hunterHp);
            specialMsg = `💚 <b>Nature Shield!</b> You heal <b>${healAmount} HP</b> and strike for ${damageDealt}!`;
            break;
          case "flame":
            damageDealt = rand(session.baseHunterAtk * 1.8);
            session.burnDmgPerRound = Math.floor(session.baseMonsterAtk * 0.15);
            specialMsg = `🔥 <b>Burning Strike!</b> Monster ignites! ${session.burnDmgPerRound} burn/round!`;
            break;
          case "ice":
            damageDealt = rand(session.baseHunterAtk * 1.4);
            session.frozenRoundsLeft = 2;
            specialMsg = `❄️ <b>Frost Nova!</b> Monster is frozen for 2 rounds!`;
            break;
          case "lightning":
            damageDealt = rand(session.baseHunterAtk * 1.6) * 2;
            specialMsg = `⚡ <b>Lightning Bolt!</b> Hits twice for ${damageDealt} total!`;
            break;
          case "crimson":
            atkMultiplier = isLow ? 3.0 : 1.8;
            damageDealt = rand(session.baseHunterAtk * atkMultiplier);
            specialMsg = isLow
              ? `🩸 <b>BERSERKER RAGE!</b> Near-death fury! ${damageDealt} dmg!`
              : `🩸 <b>Berserker!</b> Battle frenzy — ${damageDealt} dmg!`;
            break;
          case "divine":
            damageDealt = rand(session.baseHunterAtk * 2.0);
            healAmount = 30;
            specialMsg = `✨ <b>Holy Smite!</b> Holy light heals you for ${healAmount} HP!`;
            break;
          case "void":
            damageDealt = rand((session.aura?.bonusInt || 20) * 8);
            specialMsg = `🕳️ <b>Void Collapse!</b> Pure INT damage: ${damageDealt}!`;
            break;
          case "golden":
            const isCrit = Math.random() < 0.5;
            damageDealt = rand(session.baseHunterAtk * (isCrit ? 2.5 : 1.5));
            specialMsg = isCrit
              ? `🌟 <b>CRITICAL! Golden Strike!</b> ${damageDealt} dmg!`
              : `🌟 <b>Golden Strike!</b> ${damageDealt} dmg.`;
            break;
          case "shadow":
            damageDealt = rand(session.baseHunterAtk * 3.0);
            specialMsg = `🌑 <b>SHADOW MONARCH'S WRATH!</b> ${damageDealt} dmg!`;
            break;
          case "monarch":
            const isInstakill = session.monsterHp > 0 && Math.random() < 0.2;
            if (isInstakill) {
              damageDealt = session.monsterHp;
              specialMsg = `👑 <b>ABSOLUTE POWER!</b> The monster crumbles before your presence!`;
            } else {
              damageDealt = rand(session.baseHunterAtk * 5.0);
              specialMsg = `👑 <b>Absolute Power!</b> ${damageDealt} devastating damage!`;
            }
            break;
          default:
            damageDealt = rand(session.baseHunterAtk * 1.5);
            specialMsg = `✨ Aura burst: ${damageDealt} dmg!`;
        }
      }
      // Apply weapon bonus to aura moves too
      if (session.weapon?.special === "Holy Smite") damageDealt = Math.floor(damageDealt * 1.3);
      break;
    }
  }

  // MP cost
  if (mpCost > 0) {
    session.hunterMp = Math.max(0, session.hunterMp - mpCost);
  }

  // Weapon specials on normal/power attacks
  if ((move === "strike" || move === "power") && session.weapon) {
    if (session.weapon.special === "Lifesteal") {
      healAmount = Math.floor(damageDealt * 0.1);
    }
    if (session.weapon.special === "Berserker" && isLow) {
      damageDealt = Math.floor(damageDealt * 2);
      specialMsg = `🥊 <b>BERSERKER!</b> Low HP rage — damage doubled!`;
    }
    if (session.weapon.special === "Monarch's Decree") {
      const bonus = Math.floor(damageDealt * 0.5);
      damageDealt += bonus;
    }
  }

  // Apply burn to monster
  if (session.burnDmgPerRound > 0 && move !== "aura") {
    const burnDmg = session.burnDmgPerRound;
    session.monsterHp = Math.max(0, session.monsterHp - burnDmg);
    specialMsg += ` 🔥 Burn: ${burnDmg} dmg!`;
  }

  // Apply damage to monster
  session.monsterHp = Math.max(0, session.monsterHp - damageDealt);

  // Heal if any
  if (healAmount > 0) {
    session.hunterHp = Math.min(session.hunterMaxHp, session.hunterHp + healAmount);
  }

  // Monster attacks (if not skipped by guard/bow)
  if (!skipMonsterAttack) {
    const frozenPenalty = session.frozenRoundsLeft > 0 ? 0.5 : 1;
    if (session.frozenRoundsLeft > 0) session.frozenRoundsLeft--;
    damageTaken = rand(session.baseMonsterAtk * frozenPenalty);
    session.hunterHp = Math.max(0, session.hunterHp - damageTaken);
  }

  // Build round log
  const hpBar = buildHpBar(session.monsterHp, session.monsterMaxHp);
  if (specialMsg) log.push(specialMsg);
  if (move !== "guard" && !specialMsg) {
    log.push(`⚔️ You deal <b>${damageDealt}</b> dmg!`);
  }
  if (!skipMonsterAttack) {
    log.push(`${session.monster.emoji} Counterattacks for <b>${damageTaken}</b>!`);
  }
  log.push(`${hpBar}`);
  log.push(`❤️ Your HP: <b>${session.hunterHp}/${session.hunterMaxHp}</b> | 💙 MP: <b>${session.hunterMp}/${session.hunterMaxMp}</b>`);

  return {
    ended: session.monsterHp <= 0 || session.hunterHp <= 0,
    won: session.monsterHp <= 0 && session.hunterHp > 0,
    roundLog: log,
    damageDealt,
    damageTaken,
  };
}

function buildHpBar(hp: number, maxHp: number): string {
  const pct = Math.max(0, Math.min(1, hp / maxHp));
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  return `👹 [${bar}] ${Math.max(0, hp)}/${maxHp} HP`;
}

export function buildMoveButtons(session: CombatSession): Array<Array<{ text: string; callback_data: string }>> {
  const id = session.telegramId;
  const canPower = session.hunterMp >= 25;
  const canShadow = canShadowSlash(session.shadowCount, session.hunterMp);
  const canAura = canAuraBurst(session.aura);
  const auraLabel = getAuraMoveLabel(session.aura);

  const row1 = [
    { text: "⚔️ Strike", callback_data: `cm_strike_${id}` },
    { text: canPower ? "💥 Power Strike" : "💥 Power (MP!)", callback_data: canPower ? `cm_power_${id}` : `cm_noop_${id}` },
  ];
  const row2 = [
    { text: canShadow ? "🌑 Shadow Slash" : "🌑 Shadow (no MP)", callback_data: canShadow ? `cm_shadow_${id}` : `cm_noop_${id}` },
    { text: "🛡️ Guard", callback_data: `cm_guard_${id}` },
  ];
  const row3 = canAura
    ? [{ text: auraLabel, callback_data: `cm_aura_${id}` }]
    : [];

  const weaponRow = session.weapon
    ? [{ text: `${session.weapon.emoji} ${session.weapon.name} equipped`, callback_data: `cm_weapon_info_${id}` }]
    : [];

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [row1, row2];
  if (row3.length) buttons.push(row3);
  if (weaponRow.length) buttons.push(weaponRow);
  return buttons;
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, session] of combatSessions.entries()) {
    if (session.expiresAt < now) combatSessions.delete(key);
  }
}
