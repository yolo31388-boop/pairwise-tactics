// 地形系统：地形移动消耗、单位地形适应性、高低差、战斗地形效果。
//
// 设计说明：
// - TERRAIN_COSTS 给出每种地形对各单位类型的基础移动消耗；null 表示该单位
//   无法通过该地形。未知地形按平地（plain）处理。
// - 高低差在基础消耗上按配置进行修正：上坡增加、下坡减少（可配置，不会
//   降到 0 以下）。
// - 障碍物（rock、building）完全不可通行，且阻挡远程攻击视线。

const TERRAIN_COSTS = {
  plain:    { infantry: 1, knight: 1, ranger: 1,   flying: 1 },
  forest:   { infantry: 2, knight: 3, ranger: 1,   flying: 1 },
  mountain: { infantry: 3, knight: null, ranger: 2, flying: 1 },
  water:    { infantry: 4, knight: 4, ranger: 3,   flying: 1 },
};

const IMPASSABLE_TERRAIN = ['rock', 'building'];

const TERRAIN_DEFENSE = {
  plain: 0,
  forest: 2,
  mountain: 3,
  water: 0,
  rock: 4,
  building: 5,
};

const TERRAIN_EVADE = {
  plain: 0,
  forest: 20,
  mountain: 10,
  water: 0,
  rock: 0,
  building: 30,
};

const DEFAULT_CONFIG = {
  uphillCostPerLevel: 1,   // 每级高度差，上坡额外增加的消耗
  downhillCostPerLevel: 1, // 每级高度差，下坡减少的消耗
  minMoveCost: 1,          // 单格消耗下限，防止下坡减成 0
};

const key = (x, y) => `${x},${y}`;

class Terrain {
  constructor(config = {}) {
    this.tiles = {};
    this.heights = {};
    this.config = Object.assign({}, DEFAULT_CONFIG, config);
  }

  setTile(x, y, type) {
    this.tiles[key(x, y)] = type;
  }

  getTile(x, y) {
    return this.tiles[key(x, y)] || 'plain';
  }

  setHeight(x, y, height) {
    this.heights[key(x, y)] = height;
  }

  getHeight(x, y) {
    const h = this.heights[key(x, y)];
    return typeof h === 'number' ? h : 0;
  }

  isBlocked(x, y) {
    return IMPASSABLE_TERRAIN.includes(this.getTile(x, y));
  }

  isPassableForUnit(x, y, unitType) {
    const type = this.getTile(x, y);
    if (IMPASSABLE_TERRAIN.includes(type)) return false;
    const costs = TERRAIN_COSTS[type] || TERRAIN_COSTS.plain;
    const cost = Object.prototype.hasOwnProperty.call(costs, unitType)
      ? costs[unitType]
      : (costs.infantry != null ? costs.infantry : 1);
    return cost !== null;
  }

  getMoveCost(x, y, unitType, fromX, fromY) {
    const type = this.getTile(x, y);
    if (IMPASSABLE_TERRAIN.includes(type)) return Infinity;

    const costs = TERRAIN_COSTS[type] || TERRAIN_COSTS.plain;
    let base;
    if (Object.prototype.hasOwnProperty.call(costs, unitType)) {
      base = costs[unitType];
    } else {
      base = costs.infantry != null ? costs.infantry : 1;
    }
    if (base === null) return Infinity;

    // 高低差修正：只有在给定来源格时才计算。
    if (fromX !== undefined && fromY !== undefined) {
      const diff = this.getHeight(x, y) - this.getHeight(fromX, fromY);
      if (diff > 0) {
        base += diff * this.config.uphillCostPerLevel;
      } else if (diff < 0) {
        base = Math.max(
          this.config.minMoveCost,
          base - (-diff) * this.config.downhillCostPerLevel
        );
      }
    }
    return base;
  }

  getDefenseBonus(x, y) {
    return TERRAIN_DEFENSE[this.getTile(x, y)] || 0;
  }

  getEvadeBonus(x, y) {
    return TERRAIN_EVADE[this.getTile(x, y)] || 0;
  }
}

module.exports = { Terrain, TERRAIN_COSTS, IMPASSABLE_TERRAIN };
