// 寻路系统：
// - getMoveRange / getPath 基于 Dijkstra，边权为“进入目标格”的地形消耗
//   （含单位适应性与高低差修正）。障碍物、越界、被其他单位占据的格子
//   完全不可通行。
// - getAttackRange 基于格子距离（曼哈顿，4 邻接），并用 supercover 视线
//   算法剔除被障碍物（或其他单位实体）遮挡的格子。

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

const EPS = 1e-9;

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(node) {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].dist <= items[i].dist) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < n && items[left].dist < items[smallest].dist) smallest = left;
        if (right < n && items[right].dist < items[smallest].dist) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

class Pathfinding {
  constructor(map) {
    this.map = map;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  // 目标格上是否有“别的”单位（移动单位自身所在格允许）。
  occupiedByOther(x, y, unit) {
    const units = this.map.units || [];
    return units.some((u) => {
      if (u === unit) return false;
      if (unit && u.x === unit.x && u.y === unit.y) return false;
      return u.x === x && u.y === y;
    });
  }

  canEnter(x, y, unit) {
    if (!this.inBounds(x, y)) return false;
    const unitType = unit ? unit.type : undefined;
    if (this.map.terrain.isBlocked(x, y)) return false;
    if (unitType && !this.map.terrain.isPassableForUnit(x, y, unitType)) return false;
    if (this.occupiedByOther(x, y, unit)) return false;
    return true;
  }

  moveCost(fromX, fromY, x, y, unit) {
    const unitType = unit ? unit.type : undefined;
    return this.map.terrain.getMoveCost(x, y, unitType, fromX, fromY);
  }

  // Dijkstra：返回 {dist, prev}，key 为 "x,y"。
  dijkstra(startX, startY, maxMove, unit) {
    const dist = new Map();
    const prev = new Map();
    const startKey = `${startX},${startY}`;
    dist.set(startKey, 0);

    const heap = new MinHeap();
    heap.push({ x: startX, y: startY, dist: 0 });

    while (heap.size > 0) {
      const cur = heap.pop();
      const curKey = `${cur.x},${cur.y}`;
      if (cur.dist > (dist.get(curKey) ?? Infinity) + EPS) continue;

      for (const { dx, dy } of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!this.canEnter(nx, ny, unit)) continue;

        const step = this.moveCost(cur.x, cur.y, nx, ny, unit);
        if (!isFinite(step)) continue;
        const nd = cur.dist + step;
        if (nd > maxMove + EPS) continue;

        const nKey = `${nx},${ny}`;
        if (nd < (dist.get(nKey) ?? Infinity) - EPS) {
          dist.set(nKey, nd);
          prev.set(nKey, curKey);
          heap.push({ x: nx, y: ny, dist: nd });
        }
      }
    }
    return { dist, prev };
  }

  // 返回消耗不超过 maxMove 的所有可达格子（含起点）。
  getMoveRange(startX, startY, maxMove, unit) {
    if (!this.inBounds(startX, startY)) return [];
    const { dist } = this.dijkstra(startX, startY, maxMove, unit);
    const range = [];
    for (const [keyName, d] of dist) {
      if (d <= maxMove + EPS) {
        const [x, y] = keyName.split(',').map(Number);
        range.push({ x, y });
      }
    }
    return range;
  }

  // 返回从起点到终点的完整格子序列（含起点与终点，相邻步为 4 邻接）。
  // 不可达时返回 null。可选 maxMove 限制总消耗。
  getPath(startX, startY, endX, endY, unit, maxMove = Infinity) {
    if (!this.inBounds(startX, startY) || !this.inBounds(endX, endY)) return null;
    if (startX === endX && startY === endY) return [{ x: startX, y: startY }];

    const { dist, prev } = this.dijkstra(startX, startY, maxMove, unit);
    const endKey = `${endX},${endY}`;
    if (!dist.has(endKey)) return null;

    const path = [];
    let curKey = endKey;
    while (curKey) {
      const [x, y] = curKey.split(',').map(Number);
      path.push({ x, y });
      if (x === startX && y === startY) break;
      curKey = prev.get(curKey);
    }
    path.reverse();
    return path;
  }

  // supercover 视线：返回从 (x0,y0) 到 (x1,y1) 线段经过的格子（不含起点，含终点）。
  lineOfSightCells(x0, y0, x1, y1) {
    const cells = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let x = x0;
    let y = y0;
    let err = dx - dy;
    let guard = 0;

    while (guard++ <= dx + dy + 2) {
      const e2 = 2 * err;
      let movedX = false;
      let movedY = false;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
        movedX = true;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
        movedY = true;
      }
      cells.push({ x, y, corner: movedX && movedY });
      if (x === x1 && y === y1) break;
    }
    return cells;
  }

  // 视线是否被遮挡。对角跨越时，只要两个相邻格中有一个阻挡物即视为遮挡，
  // 保证攻击不能“穿过角落”的障碍物。终点格阻挡时同样不可攻击。
  hasLineOfSight(x0, y0, x1, y1, attacker) {
    const cells = this.lineOfSightCells(x0, y0, x1, y1);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const isTarget = i === cells.length - 1;
      if (this.map.terrain.isBlocked(cell.x, cell.y)) return false;
      // 视线沿途（终点除外）不能穿过其他单位。
      if (!isTarget && this.occupiedByOther(cell.x, cell.y, attacker)) return false;
      if (cell.corner) {
        const px = cell.x - (x1 > x0 ? 1 : x1 < x0 ? -1 : 0);
        const py = cell.y - (y1 > y0 ? 1 : y1 < y0 ? -1 : 0);
        if (this.map.terrain.isBlocked(px, cell.y) || this.map.terrain.isBlocked(cell.x, py)) {
          return false;
        }
      }
    }
    return true;
  }

  // 攻击范围：曼哈顿格子距离 1..range，且视线不被地形阻挡。
  getAttackRange(x, y, range, unit) {
    const result = [];
    if (!this.inBounds(x, y)) return result;
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0 || dist > range) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (!this.inBounds(tx, ty)) continue;
        if (!this.hasLineOfSight(x, y, tx, ty, unit)) continue;
        result.push({ x: tx, y: ty });
      }
    }
    return result;
  }
}

module.exports = { Pathfinding };
