
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
