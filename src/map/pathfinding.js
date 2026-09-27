// 基于 Dijkstra 的战棋寻路：按格子地形消耗（含高低差）累计代价
class Pathfinding {
  constructor(map) {
    this.terrain = map.terrain;
    this.width = map.width;
    this.height = map.height;
    this.units = map.units || [];
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isOccupied(x, y, ignoreUnit) {
    return this.units.some(u => u !== ignoreUnit && u.x === x && u.y === y);
  }

  // Dijkstra：返回 { dist, prev }，maxCost 为 null 时不限代价
  dijkstra(startX, startY, maxCost, unit) {
    const unitType = unit ? unit.type : undefined;
    const dist = new Map();
    const prev = new Map();
    const key = (x, y) => `${x},${y}`;
    const queue = [{ x: startX, y: startY, cost: 0 }];
    dist.set(key(startX, startY), 0);

    while (queue.length > 0) {
      let bestIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].cost < queue[bestIdx].cost) bestIdx = i;
      }
      const current = queue.splice(bestIdx, 1)[0];
      const curKey = key(current.x, current.y);
      if (current.cost > dist.get(curKey)) continue;

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];
      for (const next of neighbors) {
        if (!this.inBounds(next.x, next.y)) continue;
        if (this.terrain.isBlocked(next.x, next.y)) continue;
        if (this.isOccupied(next.x, next.y, unit)) continue;
        const step = this.terrain.getStepCost(current.x, current.y, next.x, next.y, unitType);
        if (!isFinite(step)) continue;
        const newCost = current.cost + step;
        if (maxCost !== null && maxCost !== undefined && newCost > maxCost) continue;
        const nextKey = key(next.x, next.y);
        if (!dist.has(nextKey) || newCost < dist.get(nextKey)) {
          dist.set(nextKey, newCost);
          prev.set(nextKey, curKey);
          queue.push({ x: next.x, y: next.y, cost: newCost });
        }
      }
    }
    return { dist, prev };
  }

  // 可移动范围：Dijkstra 累计消耗不超过 maxMove 的所有格子（含起点，附带 cost）
  getMoveRange(startX, startY, maxMove, unit) {
    const { dist } = this.dijkstra(startX, startY, maxMove, unit);
    const range = [];
    for (const [k, cost] of dist.entries()) {
      const [x, y] = k.split(',').map(Number);
      range.push({ x, y, cost });
    }
    return range;
  }

  // 完整路径：从起点到目标的相邻格子序列（含起点与终点），不可达返回 null
  getPath(startX, startY, endX, endY, unit) {
    if (!this.inBounds(endX, endY)) return null;
    if (this.terrain.isBlocked(endX, endY)) return null;
    if (this.isOccupied(endX, endY, unit)) return null;
    const { dist, prev } = this.dijkstra(startX, startY, null, unit);
    const endKey = `${endX},${endY}`;
    if (!dist.has(endKey)) return null;
    const path = [];
    let cursor = endKey;
    while (cursor !== undefined) {
      const [x, y] = cursor.split(',').map(Number);
      path.unshift({ x, y });
      cursor = prev.get(cursor);
    }
    return path;
  }

  // 攻击范围：按格子距离 BFS 扩散，障碍物阻挡视线（不能穿过，也不包含障碍格）
  getAttackRange(x, y, range) {
    const result = [];
    const visited = new Set([`${x},${y}`]);
    let frontier = [{ x, y }];
    for (let step = 1; step <= range; step++) {
      const nextFrontier = [];
      for (const cell of frontier) {
        const neighbors = [
          { x: cell.x + 1, y: cell.y },
          { x: cell.x - 1, y: cell.y },
          { x: cell.x, y: cell.y + 1 },
          { x: cell.x, y: cell.y - 1 },
        ];
        for (const next of neighbors) {
          if (!this.inBounds(next.x, next.y)) continue;
          const k = `${next.x},${next.y}`;
          if (visited.has(k)) continue;
          visited.add(k);
          if (this.terrain.isBlocked(next.x, next.y)) continue; // 阻挡：不加入也不穿透
          result.push({ x: next.x, y: next.y });
          nextFrontier.push(next);
        }
      }
      frontier = nextFrontier;
    }
    return result;
  }
}

module.exports = { Pathfinding };
