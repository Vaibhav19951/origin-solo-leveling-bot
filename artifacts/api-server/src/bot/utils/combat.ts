import type { Hunter } from "@workspace/db";
import type { Monster } from "../data/monsters";
import type { Dungeon } from "../data/dungeons";

export interface CombatResult {
  won: boolean;
  rounds: number;
  damageDealt: number;
  damageTaken: number;
  log: string[];
}

export function simulateCombat(hunter: Hunter, monster: Monster): CombatResult {
  const hunterAtk = Math.max(5, hunter.strength * 2.5 + hunter.level * 1.5);
  const monsterDef = monster.strength * 0.3;
  const hunterDmgPerRound = Math.max(1, (hunterAtk - monsterDef) * (0.85 + Math.random() * 0.3));

  const monsterAtk = monster.strength * 1.8;
  const hunterDef = hunter.agility * 0.5;
  const monsterDmgPerRound = Math.max(1, (monsterAtk - hunterDef) * (0.85 + Math.random() * 0.3));

  let hunterHp = hunter.hp;
  let monsterHp = monster.hp;
  let round = 0;
  const log: string[] = [];
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;

  while (hunterHp > 0 && monsterHp > 0 && round < 50) {
    round++;
    const dmgToMonster = Math.floor(hunterDmgPerRound * (0.9 + Math.random() * 0.2));
    const dmgToHunter = Math.floor(monsterDmgPerRound * (0.9 + Math.random() * 0.2));

    monsterHp -= dmgToMonster;
    totalDamageDealt += dmgToMonster;

    if (monsterHp <= 0) {
      log.push(`⚔️ Round ${round}: You deal <b>${dmgToMonster}</b> damage — ${monster.name} is defeated!`);
      break;
    }

    hunterHp -= dmgToHunter;
    totalDamageTaken += dmgToHunter;

    if (round <= 3) {
      log.push(`⚔️ Round ${round}: You deal <b>${dmgToMonster}</b> | ${monster.emoji} deals <b>${dmgToHunter}</b>`);
    }

    if (hunterHp <= 0) {
      log.push(`💀 Round ${round}: ${monster.name} overpowers you!`);
      break;
    }
  }

  return {
    won: hunterHp > 0,
    rounds: round,
    damageDealt: totalDamageDealt,
    damageTaken: totalDamageTaken,
    log,
  };
}

export interface DungeonResult {
  won: boolean;
  wavesCleared: number;
  damageDealt: number;
  damageTaken: number;
  log: string[];
}

export function simulateDungeon(hunter: Hunter, dungeon: Dungeon): DungeonResult {
  const log: string[] = [];
  let hunterHp = hunter.hp;
  let wavesCleared = 0;
  let totalDealt = 0;
  let totalTaken = 0;

  // Wave combat
  for (let wave = 1; wave <= dungeon.waves; wave++) {
    if (hunterHp <= 0) break;

    const waveMonsterHp = dungeon.bossHp * 0.25 * wave;
    const waveMonsterStr = dungeon.bossStrength * 0.4 * (1 + wave * 0.1);

    const hunterAtk = Math.max(5, hunter.strength * 2.5 + hunter.level * 1.5);
    const monsterDef = waveMonsterStr * 0.3;
    const hunterDmgPerRound = Math.max(1, (hunterAtk - monsterDef) * (0.85 + Math.random() * 0.3));
    const monsterAtk = waveMonsterStr * 1.8;
    const hunterDef = hunter.agility * 0.5;
    const monsterDmgPerRound = Math.max(1, (monsterAtk - hunterDef) * (0.85 + Math.random() * 0.3));

    let mHp = waveMonsterHp;
    let waveOver = false;

    for (let r = 0; r < 30 && !waveOver; r++) {
      const dmgToM = Math.floor(hunterDmgPerRound * (0.9 + Math.random() * 0.2));
      const dmgToH = Math.floor(monsterDmgPerRound * (0.9 + Math.random() * 0.2));
      mHp -= dmgToM;
      totalDealt += dmgToM;
      if (mHp <= 0) { waveOver = true; break; }
      hunterHp -= dmgToH;
      totalTaken += dmgToH;
      if (hunterHp <= 0) { waveOver = true; break; }
    }

    if (hunterHp > 0) {
      wavesCleared++;
      log.push(`✅ Wave ${wave} cleared! HP remaining: <b>${Math.max(0, hunterHp)}</b>`);
    } else {
      log.push(`💀 Wave ${wave}: You were overwhelmed!`);
      break;
    }
  }

  // Boss fight
  if (hunterHp > 0) {
    log.push(`⚠️ <b>BOSS APPEARS: ${dungeon.bossName}!</b>`);
    const hunterAtk = Math.max(5, hunter.strength * 2.5 + hunter.level * 1.5);
    const bossDef = dungeon.bossStrength * 0.4;
    const hunterDmgPerRound = Math.max(1, (hunterAtk - bossDef) * (0.85 + Math.random() * 0.3));
    const bossAtk = dungeon.bossStrength * 2;
    const hunterDef = hunter.agility * 0.5;
    const bossDmgPerRound = Math.max(1, (bossAtk - hunterDef) * (0.85 + Math.random() * 0.3));

    let bossHp = dungeon.bossHp;
    for (let r = 0; r < 50; r++) {
      const dmgToBoss = Math.floor(hunterDmgPerRound * (0.9 + Math.random() * 0.2));
      const dmgToH = Math.floor(bossDmgPerRound * (0.9 + Math.random() * 0.2));
      bossHp -= dmgToBoss;
      totalDealt += dmgToBoss;
      if (bossHp <= 0) {
        log.push(`🏆 <b>${dungeon.bossName} has been defeated!</b>`);
        break;
      }
      hunterHp -= dmgToH;
      totalTaken += dmgToH;
      if (hunterHp <= 0) {
        log.push(`💀 <b>${dungeon.bossName} defeats you!</b>`);
        break;
      }
    }
  }

  return {
    won: hunterHp > 0,
    wavesCleared,
    damageDealt: totalDealt,
    damageTaken: totalTaken,
    log,
  };
}
