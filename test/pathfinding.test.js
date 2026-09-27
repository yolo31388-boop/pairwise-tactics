
const { Pathfinding } = require('../src/map/pathfinding.js');
const { Terrain } = require('../src/map/terrain.js');
const { Unit } = require('../src/units/unit.js');

describe('战棋格子移动', () => {
  test('Dijkstra移动范围', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getMoveRange(5, 5, 3, new Unit(5,5,'infantry'));
    expect(range.length).toBeGreaterThan(0);
  });
  test('不同地形消耗', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');
    expect(terrain.getMoveCost(5, 6, 'infantry')).toBeGreaterThan(1);
  });
  test('障碍物不可通行', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'rock');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getMoveRange(5, 5, 5, new Unit(5,5,'infantry'));
    expect(range.some(r => r.x===5 && r.y===6)).toBe(false);
  });
  test('高低差消耗', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'mountain');
    expect(terrain.getMoveCost(5, 6, 'infantry')).toBeGreaterThan(2);
  });
  test('最大移动力限制', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:20, height:20, units:[]});
    const range = pf.getMoveRange(10, 10, 2, new Unit(10,10,'infantry'));
    for (const r of range) {
      expect(Math.abs(r.x-10)+Math.abs(r.y-10)).toBeLessThanOrEqual(2);
    }
  });
  test('攻击范围地形阻挡', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'rock');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getAttackRange(5, 5, 3);
    expect(range.some(r => r.x===5 && r.y===7)).toBe(false);
  });
  test('路径格子相邻', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const path = pf.getPath(0, 0, 3, 0);
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i].x-path[i-1].x) + Math.abs(path[i].y-path[i-1].y);
      expect(d).toBe(1);
    }
  });
  test('单位不重叠', () => {
    const terrain = new Terrain();
    const units = [new Unit(5, 6, 'enemy')];
    const pf = new Pathfinding({terrain, width:10, height:10, units});
    const range = pf.getMoveRange(5, 5, 3, new Unit(5,5,'player'));
    expect(range.some(r => r.x===5 && r.y===6)).toBe(false);
  });
  test('地形防御加成', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 5, 'forest');
    expect(terrain.getDefenseBonus(5, 5)).toBeGreaterThan(0);
  });
  test('地图边界处理', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:5, height:5, units:[]});
    const range = pf.getMoveRange(0, 0, 5, new Unit(0,0,'infantry'));
    for (const r of range) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
    }
  });
  test('森林地形适应性', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');
    expect(terrain.getMoveCost(5, 6, 'ranger')).toBeLessThan(terrain.getMoveCost(5, 6, 'knight'));
  });
  test('多地形混合路径', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');
    terrain.setTile(5, 7, 'mountain');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const path = pf.getPath(5, 5, 5, 8);
    expect(path.length).toBeGreaterThan(3);
  });
});

describe('战棋格子移动 - 增强不变量', () => {
  const makeMap = (terrain, width = 12, height = 12, units = []) =>
    new Pathfinding({ terrain, width, height, units });
  const has = (cells, x, y) => cells.some((c) => c.x === x && c.y === y);

  test('Dijkstra按累计消耗而非曼哈顿距离裁剪', () => {
    const terrain = new Terrain();
    // 森林带：直线穿森林消耗大，平地绕路消耗小。
    terrain.setTile(3, 2, 'forest');
    terrain.setTile(4, 2, 'forest');
    const pf = makeMap(terrain);
    const unit = new Unit(2, 2, 'infantry');
    const range = pf.getMoveRange(2, 2, 3, unit);
    // 曼哈顿距离 1 的森林格消耗 2，可达；但继续穿森林(再+2=4)不可达，
    // 且没有任何绕行能在 3 点消耗内抵达第二片森林。
    expect(has(range, 3, 2)).toBe(true);
    expect(has(range, 4, 2)).toBe(false);
    // 同样曼哈顿距离 2 的纯平地步道可达（累计消耗 2）。
    expect(has(range, 2, 4)).toBe(true);
  });

  test('四种地形基础消耗各不相同且为正', () => {
    const terrain = new Terrain();
    terrain.setTile(0, 0, 'plain');
    terrain.setTile(0, 1, 'forest');
    terrain.setTile(0, 2, 'mountain');
    terrain.setTile(0, 3, 'water');
    const costs = [0, 1, 2, 3].map((y) => terrain.getMoveCost(0, y, 'infantry'));
    expect(costs).toEqual([1, 2, 3, 4]);
    expect(new Set(costs).size).toBe(4);
  });

  test('rock与building完全不可通行，且能被绕行', () => {
    const terrain = new Terrain();
    terrain.setTile(2, 1, 'rock');
    terrain.setTile(2, 3, 'building');
    const pf = makeMap(terrain);
    const unit = new Unit(2, 2, 'infantry');
    const range = pf.getMoveRange(2, 2, 4, unit);
    expect(has(range, 2, 1)).toBe(false);
    expect(has(range, 2, 3)).toBe(false);
    // 障碍两侧依然可以绕路到达。
    expect(has(range, 3, 1)).toBe(true);
    expect(has(range, 1, 3)).toBe(true);
    // 障碍墙另一侧在移动力内无法穿过。
    const terrain2 = new Terrain();
    for (let x = 0; x < 8; x++) terrain2.setTile(x, 6, 'rock');
    const pf2 = makeMap(terrain2, 8, 12);
    const range2 = pf2.getMoveRange(3, 5, 3, new Unit(3, 5, 'infantry'));
    expect(has(range2, 3, 7)).toBe(false);
  });

  test('上坡消耗增加、下坡消耗减少（按配置）', () => {
    const terrain = new Terrain({ uphillCostPerLevel: 2, downhillCostPerLevel: 1 });
    terrain.setTile(1, 0, 'plain');
    terrain.setTile(0, 1, 'plain');
    terrain.setHeight(1, 0, 2);
    terrain.setHeight(0, 1, -1);
    // 基础 1 + 2 级 * 2 = 5；下坡 1 级：max(1, 1-1)=1。
    expect(terrain.getMoveCost(1, 0, 'infantry', 0, 0)).toBe(5);
    expect(terrain.getMoveCost(0, 1, 'infantry', 0, 0)).toBe(1);
    // 下坡减成不会把单格消耗压到 minMoveCost 以下。
    terrain.setHeight(0, 2, -10);
    terrain.setTile(0, 2, 'plain');
    expect(terrain.getMoveCost(0, 2, 'infantry', 0, 1)).toBeGreaterThanOrEqual(1);
  });

  test('高低差使移动范围上下不对称', () => {
    const terrain = new Terrain({ uphillCostPerLevel: 2, downhillCostPerLevel: 1 });
    for (let y = 1; y <= 5; y++) terrain.setHeight(5, y, y);
    const pf = makeMap(terrain);
    const range = pf.getMoveRange(5, 0, 3, new Unit(5, 0, 'infantry'));
    // 上坡第一格消耗 1+2=3，勉强可达；第二格 1+2+2=5 不可达。
    expect(has(range, 5, 1)).toBe(true);
    expect(has(range, 5, 2)).toBe(false);
    // 两侧平地正常可达。
    expect(has(range, 6, 0)).toBe(true);
  });

  test('移动范围精确等于移动力：平地上菱形清点', () => {
    const terrain = new Terrain();
    const pf = makeMap(terrain, 20, 20);
    const range = pf.getMoveRange(10, 10, 2, new Unit(10, 10, 'infantry'));
    // 消耗 0..2 的格子数 = 1 + 4 + 8 = 13，不多不少。
    expect(range.length).toBe(13);
    for (const r of range) {
      expect(Math.abs(r.x - 10) + Math.abs(r.y - 10)).toBeLessThanOrEqual(2);
    }
    expect(has(range, 12, 10)).toBe(true);
    expect(has(range, 13, 10)).toBe(false);
  });

  test('远程攻击不能穿过障碍物（rock/building）', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'rock');
    const pf = makeMap(terrain);
    const range = pf.getAttackRange(5, 5, 3);
    expect(has(range, 5, 7)).toBe(false);
    expect(has(range, 5, 6)).toBe(false);
    // 未被遮挡的目标仍在范围内。
    expect(has(range, 5, 8)).toBe(false); // 同列全部被挡
    expect(has(range, 6, 5)).toBe(true);  // 未被遮挡的方向
    expect(has(range, 6, 6)).toBe(false); // 对角跨越岩石角同样被遮挡
    terrain.setTile(7, 5, 'building');
    expect(has(pf.getAttackRange(5, 5, 3), 9, 5)).toBe(false);
  });

  test('路径含起点终点且每步相邻，不可达返回null', () => {
    const terrain = new Terrain();
    const pf = makeMap(terrain);
    const path = pf.getPath(0, 0, 3, 2, new Unit(0, 0, 'infantry'));
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 3, y: 2 });
    expect(path.length).toBe(6);
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i].x - path[i - 1].x)
              + Math.abs(path[i].y - path[i - 1].y);
      expect(d).toBe(1);
    }
    // 被石墙完全隔断时返回 null。
    for (let y = 0; y < 12; y++) terrain.setTile(6, y, 'rock');
    expect(pf.getPath(0, 0, 10, 0, new Unit(0, 0, 'infantry'))).toBeNull();
  });

  test('移动到已有单位的格子被拒绝，且不能穿过单位', () => {
    const terrain = new Terrain();
    const enemy = new Unit(5, 6, 'enemy');
    const units = [enemy];
    const pf = makeMap(terrain, 12, 12, units);
    const me = new Unit(5, 5, 'player');
    expect(has(pf.getMoveRange(5, 5, 3, me), 5, 6)).toBe(false);
    // 试图直接移动到敌方格：拒绝且自身位置不变。
    const ok = me.moveTo([{ x: 5, y: 5 }, { x: 5, y: 6 }], pf);
    expect(ok).toBe(false);
    expect(me.x).toBe(5);
    expect(me.y).toBe(5);
    // 合法移动成功。
    expect(me.moveTo([{ x: 5, y: 5 }, { x: 5, y: 4 }], pf)).toBe(true);
    expect(me.y).toBe(4);
  });

  test('战斗结算应用地形防御加成与回避率', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 5, 'forest');
    expect(terrain.getDefenseBonus(5, 5)).toBe(2);
    expect(terrain.getEvadeBonus(5, 5)).toBe(20);
    const attacker = new Unit(0, 0, 'infantry', { attack: 20, hitRate: 100 });
    const target = new Unit(5, 5, 'infantry', { defense: 5, hp: 100 });
    const r = attacker.attackTarget(target, terrain, () => 0.5);
    expect(r.hit).toBe(true);
    expect(r.damage).toBe(20 - 5 - 2); // 13
    expect(target.hp).toBe(100 - 13);
    // 命中随机数落在回避区间内时未命中，不掉血。
    const target2 = new Unit(5, 5, 'infantry', { defense: 5, hp: 100 });
    const miss = attacker.attackTarget(target2, terrain, () => 0.95);
    expect(miss.hit).toBe(false);
    expect(target2.hp).toBe(100);
  });

  test('地图边界：不越界且越界路径返回null', () => {
    const terrain = new Terrain();
    const pf = makeMap(terrain, 5, 5);
    const range = pf.getMoveRange(0, 0, 8, new Unit(0, 0, 'infantry'));
    for (const r of range) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(5);
      expect(r.y).toBeLessThan(5);
    }
    // 角落实测：5x5 全平地，可到达全部 25 格。
    expect(range.length).toBe(25);
    expect(pf.getPath(0, 0, 6, 0, new Unit(0, 0, 'infantry'))).toBeNull();
    expect(pf.getMoveRange(-1, 0, 3, new Unit(-1, 0, 'infantry'))).toEqual([]);
    expect(pf.getAttackRange(0, 0, 4).every((c) => c.x >= 0 && c.y >= 0)).toBe(true);
  });

  test('森林适应性：ranger优于knight，且影响可达范围', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');
    const rangerCost = terrain.getMoveCost(5, 6, 'ranger');
    const knightCost = terrain.getMoveCost(5, 6, 'knight');
    const infantryCost = terrain.getMoveCost(5, 6, 'infantry');
    expect(rangerCost).toBeLessThan(knightCost);
    expect(rangerCost).toBe(1);
    expect(knightCost).toBe(3);
    expect(infantryCost).toBe(2);
    // 同样移动力 2：ranger 穿过森林后仍有余力，knight 无法跨过。
    terrain.setTile(5, 7, 'forest');
    const pf = makeMap(terrain);
    expect(has(pf.getMoveRange(5, 5, 2, new Unit(5, 5, 'ranger')), 5, 7)).toBe(true);
    expect(has(pf.getMoveRange(5, 5, 2, new Unit(5, 5, 'knight')), 5, 7)).toBe(false);
  });

  test('多地形混合路径选择最小累计消耗的绕行路线', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');   // 2
    terrain.setTile(5, 7, 'mountain'); // 3，直线累计 6
    const pf = makeMap(terrain);
    const unit = new Unit(5, 5, 'infantry');
    const path = pf.getPath(5, 5, 5, 8, unit, 5);
    // 移动力 5 内直线不可达（消耗 6），Dijkstra 应给出绕过地形的路径。
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(3);
    expect(path[0]).toEqual({ x: 5, y: 5 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 8 });
    for (let i = 1; i < path.length; i++) {
      expect(
        Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)
      ).toBe(1);
    }
    // 直线穿过森林+山地本身合法，但总成本为 2+3+1=6（>5 才迫使绕行）。
    const straight = [{x:5,y:5},{x:5,y:6},{x:5,y:7},{x:5,y:8}];
    let cost = 0;
    for (let i = 1; i < straight.length; i++) {
      cost += terrain.getMoveCost(straight[i].x, straight[i].y, 'infantry',
        straight[i - 1].x, straight[i - 1].y);
    }
    expect(cost).toBe(6);
  });

  test('knight不能进入山地/深水，flying无视地形消耗与障碍的适应性参考', () => {
    const terrain = new Terrain();
    terrain.setTile(1, 0, 'mountain');
    terrain.setTile(2, 0, 'water');
    expect(terrain.isPassableForUnit(1, 0, 'knight')).toBe(false);
    expect(terrain.isPassableForUnit(2, 0, 'knight')).toBe(true); // 水可走但贵
    expect(terrain.isPassableForUnit(1, 0, 'ranger')).toBe(true);
    const pf = makeMap(terrain, 20, 3);
    const range = pf.getMoveRange(0, 0, 5, new Unit(0, 0, 'knight'));
    expect(has(range, 1, 0)).toBe(false); // 山地挡住骑士
    // flying 单位山地只耗 1，可以直接通过。
    expect(terrain.getMoveCost(1, 0, 'flying')).toBe(1);
  });
});
