// 战棋单位：持有位置/属性，移动前必须经过寻路校验，战斗结算时应用地形
// 提供的防御加成与回避率。

class Unit {
  constructor(x, y, type, stats = {}) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.moveForce = stats.moveForce != null ? stats.moveForce : 5;
    this.hp = stats.hp != null ? stats.hp : 100;
    this.attack = stats.attack != null ? stats.attack : 20;
    this.defense = stats.defense != null ? stats.defense : 5;
    this.hitRate = stats.hitRate != null ? stats.hitRate : 90;
  }

  // 请求沿寻路结果移动；任何非法情况（越界、阻挡、占用、超出移动力）都拒绝。
  // 返回 true 表示移动成功。
  moveTo(path, pathfinding) {
    if (!Array.isArray(path) || path.length === 0) return false;
    const first = path[0];
    if (first.x !== this.x || first.y !== this.y) return false;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const cur = path[i];
      if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) !== 1) return false;
      if (!pathfinding.canEnter(cur.x, cur.y, this)) return false;
    }
    // 直接累计给定路径的地形消耗（含高低差），不得超过最大移动力。
    let totalCost = 0;
    for (let i = 1; i < path.length; i++) {
      const step = pathfinding.moveCost(
        path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, this
      );
      if (!isFinite(step)) return false;
      totalCost += step;
      if (totalCost > this.moveForce + 1e-9) return false;
    }
    const destination = path[path.length - 1];
    this.x = destination.x;
    this.y = destination.y;
    return true;
  }

  // 战斗结算：命中受地形回避率影响，伤害 = max(1, 攻击 - 防御 - 地形防御加成)。
  // rng 可注入，默认 Math.random，便于测试确定性。
  attackTarget(target, terrain, rng = Math.random) {
    const evade = terrain.getEvadeBonus(target.x, target.y);
    const hitChance = Math.max(0, Math.min(100, this.hitRate - evade)) / 100;
    const hit = rng() < hitChance;
    if (!hit) {
      return { hit: false, damage: 0 };
    }
    const terrainDefense = terrain.getDefenseBonus(target.x, target.y);
    const damage = Math.max(1, this.attack - target.defense - terrainDefense);
    target.hp -= damage;
    return { hit: true, damage };
  }
}

// 与 attackTarget 等价的纯函数入口，方便不构造实例时复用同一套结算规则。
function resolveCombat(attacker, target, terrain, rng = Math.random) {
  return attacker.attackTarget(target, terrain, rng);
}

module.exports = { Unit, resolveCombat };
