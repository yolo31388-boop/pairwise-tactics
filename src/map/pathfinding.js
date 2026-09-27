

class Pathfinding {
  constructor(map) { this.map = map; }
  getMoveRange(startX, startY, maxMove, unit) {
    // BUG: 用曼哈顿距离
    const range = [];
    for (let dx = -maxMove; dx <= maxMove; dx++) {
      for (let dy = -maxMove; dy <= maxMove; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= maxMove) {
          range.push({x: startX+dx, y: startY+dy});
        }
      }
    }
    return range;
  }
  getPath(startX, startY, endX, endY) {
    // BUG: 直线路径
    const path = [];
    let x = startX, y = startY;
    while (x !== endX || y !== endY) {
      if (x < endX) x++; else if (x > endX) x--;
      else if (y < endY) y++; else if (y > endY) y--;
      path.push({x, y});
    }
    return path;
  }
  getAttackRange(x, y, range) {
    // BUG: 不考虑地形阻挡
    const result = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (Math.abs(dx)+Math.abs(dy) <= range && (dx||dy)) {
          result.push({x:x+dx, y:y+dy});
        }
      }
    }
    return result;
  }
}

module.exports = { Pathfinding };
