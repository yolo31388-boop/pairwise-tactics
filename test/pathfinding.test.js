
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

const { resolveCombat } = require('../src/units/unit.js');

describe('引擎边界不变量（新增）', () => {
  test('Dijkstra移动范围：高消耗地形压缩实际可达距离', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest'); // 消耗2
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getMoveRange(5, 5, 3, new Unit(5,5,'infantry'));
    // 曼哈顿距离为3，但经森林累计消耗为 2+1+1=4 > 3，不可达
    expect(range.some(r => r.x===5 && r.y===8)).toBe(false);
    // 消耗 2+1=3，恰可达
    expect(range.some(r => r.x===5 && r.y===7)).toBe(true);
    // 绕开森林的平地格子 (6,7) 消耗3，可达
    expect(range.some(r => r.x===6 && r.y===7)).toBe(true);
  });

  test('不同地形消耗：平地/森林/山地/水域互不相同', () => {
    const terrain = new Terrain();
    terrain.setTile(0, 0, 'plain');
    terrain.setTile(0, 1, 'forest');
    terrain.setTile(0, 2, 'mountain');
    terrain.setTile(0, 3, 'water');
    const costs = ['plain','forest','mountain','water'].map((t,i) => terrain.getMoveCost(0, i, 'infantry'));
    expect(costs).toEqual([1, 2, 3, 4]);
    expect(new Set(costs).size).toBe(4);
  });

  test('障碍物不可通行：整排石墙完全阻断且无法绕过', () => {
    const terrain = new Terrain();
    for (let y = 0; y < 10; y++) terrain.setTile(5, y, 'rock');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getMoveRange(4, 5, 20, new Unit(4,5,'infantry'));
    expect(range.some(r => r.x===6 && r.y===5)).toBe(false);
    expect(range.every(r => r.x < 5)).toBe(true);
    expect(pf.getPath(4, 5, 6, 5, new Unit(4,5,'infantry'))).toBeNull();
  });

  test('高低差消耗：上坡更贵、下坡更便宜且按配置计算', () => {
    const terrain = new Terrain();
    terrain.setElevation(5, 6, 2);
    // 上坡：平地1 + 2级*1 = 3
    expect(terrain.getStepCost(5, 5, 5, 6, 'infantry')).toBe(3);
    // 下坡：平地1 - 2级*0.5 = 0，被下限钳制为0.5
    expect(terrain.getStepCost(5, 6, 5, 5, 'infantry')).toBe(0.5);
    // 自定义配置生效
    const custom = new Terrain({elevation: {upPerLevel: 2, downPerLevel: 1, minStepCost: 0.5}});
    custom.setElevation(5, 6, 1);
    expect(custom.getStepCost(5, 5, 5, 6, 'infantry')).toBe(3);
    expect(custom.getStepCost(5, 6, 5, 5, 'infantry')).toBe(0.5);
    // 上坡压缩 Dijkstra 移动范围
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getMoveRange(5, 5, 3, new Unit(5,5,'infantry'));
    expect(range.some(r => r.x===5 && r.y===6)).toBe(true);  // 消耗3，恰可达
    expect(range.some(r => r.x===5 && r.y===7)).toBe(false); // 消耗3+1=4，超出
  });

  test('最大移动力限制：范围格子数精确且消耗均不超上限', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:20, height:20, units:[]});
    const range = pf.getMoveRange(10, 10, 2, new Unit(10,10,'infantry'));
    // 平地上移动力2的菱形区域（含起点）共 1+4+8=13 格
    expect(range.length).toBe(13);
    for (const r of range) expect(r.cost).toBeLessThanOrEqual(2);
    // 不少算：消耗恰为2的格子必须在范围内
    expect(range.some(r => r.x===12 && r.y===10)).toBe(true);
  });

  test('攻击范围地形阻挡：障碍后不可达、侧翼不受影响', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'rock');
    terrain.setTile(5, 7, 'building');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const range = pf.getAttackRange(5, 5, 2);
    expect(range.some(r => r.x===5 && r.y===6)).toBe(false); // 障碍格本身不可攻击
    expect(range.some(r => r.x===5 && r.y===7)).toBe(false); // 被挡住的正后方
    expect(range.some(r => r.x===6 && r.y===6)).toBe(true);  // 侧翼正常
    expect(range.some(r => r.x===5 && r.y===4)).toBe(true);  // 反方向正常
  });

  test('路径格子相邻：含起点终点、逐步相邻、绕开障碍', () => {
    const terrain = new Terrain();
    terrain.setTile(1, 0, 'rock');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const path = pf.getPath(0, 0, 2, 0, new Unit(0,0,'infantry'));
    expect(path[0]).toEqual({x:0, y:0});
    expect(path[path.length-1]).toEqual({x:2, y:0});
    expect(path.length).toBe(5); // 绕行 (0,0)->(0,1)->(1,1)->(2,1)->(2,0)
    expect(path.some(p => p.x===1 && p.y===0)).toBe(false); // 不穿过石头
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i].x-path[i-1].x) + Math.abs(path[i].y-path[i-1].y);
      expect(d).toBe(1);
    }
  });

  test('单位不重叠：占位格不可进入也不可穿越，目标被占返回null', () => {
    const terrain = new Terrain();
    const blocker = new Unit(5, 6, 'enemy');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[blocker]});
    const mover = new Unit(5, 5, 'player');
    const range = pf.getMoveRange(5, 5, 3, mover);
    expect(range.some(r => r.x===5 && r.y===6)).toBe(false);
    expect(pf.getPath(5, 5, 5, 6, mover)).toBeNull();
    // 被挡但可绕行时仍能到达正后方
    const behind = pf.getPath(5, 5, 5, 7, mover);
    expect(behind).not.toBeNull();
    expect(behind.some(p => p.x===5 && p.y===6)).toBe(false);
  });

  test('地形防御加成与回避率：战斗结算正确应用', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 5, 'forest');
    terrain.setTile(6, 5, 'plain');
    const attacker = new Unit(5, 4, 'player', {attack: 10});
    const forestDef = new Unit(5, 5, 'enemy', {defense: 2});
    const plainDef = new Unit(6, 5, 'enemy', {defense: 2});
    // 必中随机数：森林防御+2 使伤害更低
    const rForest = resolveCombat(attacker, forestDef, terrain, () => 0.5);
    const rPlain = resolveCombat(attacker, plainDef, terrain, () => 0.5);
    expect(rForest.damage).toBe(10 - 2 - 2);
    expect(rPlain.damage).toBe(10 - 2 - 0);
    expect(rForest.damage).toBeLessThan(rPlain.damage);
    // 森林回避+20：roll 0.85*100=85 >= 80 则 miss
    const rMiss = resolveCombat(attacker, new Unit(5, 5, 'enemy'), terrain, () => 0.85);
    expect(rMiss.hit).toBe(false);
    expect(rMiss.damage).toBe(0);
    expect(rMiss.hitChance).toBe(80);
  });

  test('地图边界处理：角落范围不越界且数量精确', () => {
    const terrain = new Terrain();
    const pf = new Pathfinding({terrain, width:5, height:5, units:[]});
    const range = pf.getMoveRange(0, 0, 2, new Unit(0,0,'infantry'));
    // 角落移动力2：x+y<=2 共6格
    expect(range.length).toBe(6);
    for (const r of range) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThan(5);
      expect(r.y).toBeLessThan(5);
    }
    const atk = pf.getAttackRange(0, 0, 3);
    expect(atk.every(a => a.x >= 0 && a.y >= 0)).toBe(true);
    expect(pf.getPath(0, 0, -1, 0, new Unit(0,0,'infantry'))).toBeNull();
  });

  test('森林地形适应性：游侠穿林比骑士更远', () => {
    const terrain = new Terrain();
    for (let y = 6; y <= 8; y++) terrain.setTile(5, y, 'forest');
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const rangerRange = pf.getMoveRange(5, 5, 3, new Unit(5,5,'ranger'));
    const knightRange = pf.getMoveRange(5, 5, 3, new Unit(5,5,'knight'));
    // 游侠森林消耗1：直穿三片森林恰为3
    expect(rangerRange.some(r => r.x===5 && r.y===8)).toBe(true);
    // 骑士森林消耗3：走一格森林就到不了第二格
    expect(knightRange.some(r => r.x===5 && r.y===7)).toBe(false);
    expect(terrain.getMoveCost(5, 6, 'ranger')).toBe(1);
    expect(terrain.getMoveCost(5, 6, 'knight')).toBe(3);
  });

  test('多地形混合路径：Dijkstra 选择总消耗最低的绕行路线', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'forest');   // 消耗2
    terrain.setTile(5, 7, 'mountain'); // 消耗3
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const path = pf.getPath(5, 5, 5, 8, new Unit(5,5,'infantry'));
    // 直线消耗 2+3+1=6，绕行平地消耗5，必须选绕行
    expect(path.length).toBe(6); // 含起点共6格（5步）
    expect(path.some(p => p.x===5 && p.y===7)).toBe(false); // 不走山地
    const last = path[path.length-1];
    expect(last).toEqual({x:5, y:8});
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i].x-path[i-1].x) + Math.abs(path[i].y-path[i-1].y)).toBe(1);
    }
  });

  test('水域地形：默认高消耗，飞行单位有适应性', () => {
    const terrain = new Terrain();
    terrain.setTile(5, 6, 'water');
    expect(terrain.getMoveCost(5, 6, 'infantry')).toBe(4);
    expect(terrain.getMoveCost(5, 6, 'flying')).toBe(1);
    const pf = new Pathfinding({terrain, width:10, height:10, units:[]});
    const infRange = pf.getMoveRange(5, 5, 3, new Unit(5,5,'infantry'));
    const flyRange = pf.getMoveRange(5, 5, 3, new Unit(5,5,'flying'));
    expect(infRange.some(r => r.x===5 && r.y===6)).toBe(false); // 步兵消耗4>3进不去
    expect(flyRange.some(r => r.x===5 && r.y===6)).toBe(true);  // 飞行消耗1可进入
  });
});
