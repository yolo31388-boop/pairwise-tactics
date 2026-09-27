class Unit {
  constructor(x, y, type, stats = {}) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.moveForce = stats.moveForce !== undefined ? stats.moveForce : 5;
    this.maxHp = stats.maxHp !== undefined ? stats.maxHp : 20;
    this.hp = this.maxHp;
    this.attack = stats.attack !== undefined ? stats.attack : 8;
    this.defense = stats.defense !== undefined ? stats.defense : 2;
  }
}

// 战斗结算：地形防御加成减免伤害，地形回避率降低命中
function resolveCombat(attacker, defender, terrain, random = Math.random) {
  const avoidBonus = terrain.getAvoidBonus(defender.x, defender.y);
  const hitChance = Math.max(0, Math.min(100, 100 - avoidBonus));
  const hit = random() * 100 < hitChance;
  const defenseBonus = terrain.getDefenseBonus(defender.x, defender.y);
  const damage = hit ? Math.max(0, attacker.attack - defender.defense - defenseBonus) : 0;
  defender.hp = Math.max(0, defender.hp - damage);
  return { hit, hitChance, damage };
}

module.exports = { Unit, resolveCombat };
