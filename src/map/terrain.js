// 地形类型表：移动消耗、防御加成、回避率加成
const TERRAIN_TYPES = {
  plain:    { moveCost: 1, defense: 0, avoid: 0 },
  forest:   { moveCost: 2, defense: 2, avoid: 20 },
  mountain: { moveCost: 3, defense: 3, avoid: 10 },
  water:    { moveCost: 4, defense: 0, avoid: -10 },
  rock:     { moveCost: Infinity, defense: 0, avoid: 0 },
  building: { moveCost: Infinity, defense: 0, avoid: 0 },
};

// 单位类型对地形的适应性（覆盖基础移动消耗）
const UNIT_ADAPTATION = {
  ranger: { forest: 1 },
  knight: { forest: 3, mountain: 4 },
  flying: { forest: 1, mountain: 1, water: 1 },
  naval:  { water: 1 },
};

const DEFAULT_ELEVATION_CONFIG = {
  upPerLevel: 1,    // 每上升一级高度增加的消耗
  downPerLevel: 0.5, // 每下降一级高度减少的消耗
  minStepCost: 0.5,  // 单步消耗下限
};

class Terrain {
  constructor(config = {}) {
    this.tiles = {};
    this.elevations = {};
    this.elevationConfig = Object.assign({}, DEFAULT_ELEVATION_CONFIG, config.elevation || {});
  }

  setTile(x, y, type) {
    if (!TERRAIN_TYPES[type]) throw new Error(`未知地形类型: ${type}`);
    this.tiles[`${x},${y}`] = type;
  }

  getTile(x, y) {
    return this.tiles[`${x},${y}`] || 'plain';
  }

  setElevation(x, y, height) {
    this.elevations[`${x},${y}`] = height;
  }

  getElevation(x, y) {
    return this.elevations[`${x},${y}`] || 0;
  }

  isBlocked(x, y) {
    const t = this.getTile(x, y);
    return t === 'rock' || t === 'building';
  }

  // 某地形格子的基础移动消耗（含单位适应性），障碍物返回 Infinity
  getMoveCost(x, y, unitType) {
    if (this.isBlocked(x, y)) return Infinity;
    const type = this.getTile(x, y);
    const adaptation = unitType ? UNIT_ADAPTATION[unitType] : null;
    if (adaptation && adaptation[type] !== undefined) return adaptation[type];
    return TERRAIN_TYPES[type].moveCost;
  }

  // 高低差带来的额外消耗：上坡为正，下坡为负（按配置）
  getElevationCost(fromX, fromY, toX, toY) {
    const delta = this.getElevation(toX, toY) - this.getElevation(fromX, fromY);
    if (delta > 0) return delta * this.elevationConfig.upPerLevel;
    if (delta < 0) return delta * this.elevationConfig.downPerLevel;
    return 0;
  }

  // 从 (fromX,fromY) 走入 (toX,toY) 的单步总消耗 = 地形消耗 + 高低差消耗
  getStepCost(fromX, fromY, toX, toY, unitType) {
    const base = this.getMoveCost(toX, toY, unitType);
    if (!isFinite(base)) return Infinity;
    const total = base + this.getElevationCost(fromX, fromY, toX, toY);
    return Math.max(this.elevationConfig.minStepCost, total);
  }

  getDefenseBonus(x, y) {
    return TERRAIN_TYPES[this.getTile(x, y)].defense;
  }

  getAvoidBonus(x, y) {
    return TERRAIN_TYPES[this.getTile(x, y)].avoid;
  }
}

module.exports = { Terrain, TERRAIN_TYPES, UNIT_ADAPTATION };
