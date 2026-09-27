
class Terrain {
  constructor() { this.tiles = {}; }
  setTile(x, y, type) { this.tiles[`${x},${y}`] = type; }
  getMoveCost(x, y, unitType) {
    // BUG: 所有地形消耗相同
    return 1;
  }
  isBlocked(x, y) {
    const t = this.tiles[`${x},${y}`];
    return t === 'rock' || t === 'building';
  }
}

module.exports = { Terrain };
