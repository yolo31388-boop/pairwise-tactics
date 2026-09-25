"""战棋引擎表驱动测试：BFS 移动范围、障碍物、机会攻击、地形、攻击范围。"""

from __future__ import annotations

import pytest

from tactics import TacticsEngine, Unit


def _eng(w=8, h=8):
    return TacticsEngine(width=w, height=h)


def test_reachable_all_four_directions():
    """移动范围必须包含上下左右四个方向。"""
    eng = _eng()
    u = Unit("p1", "战士", hp=20, atk=5, move=2, attack_range=1, pos=(3, 3))
    eng.add_unit(u)
    cells = eng.reachable_cells(u)
    # 右方向 (4,3) 必须可达
    assert (4, 3) in cells, "右方向应可达"
    assert (2, 3) in cells, "左方向应可达"
    assert (3, 2) in cells, "上方向应可达"
    assert (3, 4) in cells, "下方向应可达"


def test_reachable_distance():
    eng = _eng()
    u = Unit("p1", "战士", hp=20, atk=5, move=2, attack_range=1, pos=(3, 3))
    eng.add_unit(u)
    cells = eng.reachable_cells(u)
    assert cells.get((3, 3)) == 0
    assert cells.get((4, 3)) == 1
    assert cells.get((5, 3)) == 2
    assert (6, 3) not in cells  # 超出移动力


def test_obstacle_blocks():
    eng = _eng()
    u = Unit("p1", "战士", hp=20, atk=5, move=3, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    eng.add_obstacle(1, 0)  # 右边是障碍
    cells = eng.reachable_cells(u)
    assert (1, 0) not in cells
    # 可以绕过障碍
    assert (0, 1) in cells
    assert (1, 1) in cells


def test_cannot_pass_through_units():
    eng = _eng()
    u1 = Unit("p1", "战士", hp=20, atk=5, move=3, attack_range=1, pos=(0, 0))
    u2 = Unit("e1", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(u1); eng.add_unit(u2)
    cells = eng.reachable_cells(u1)
    assert (1, 0) not in cells  # 敌人占据，不能穿过


def test_terrain_cost():
    eng = _eng()
    u = Unit("p1", "战士", hp=20, atk=5, move=3, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    eng.set_terrain(1, 0, 3)  # 右边地形消耗 3
    cells = eng.reachable_cells(u)
    assert cells.get((1, 0)) == 3
    assert (2, 0) not in cells  # 3+1=4 > move=3


def test_attack_range_based_on_current_pos():
    eng = _eng()
    a = Unit("a", "A", hp=20, atk=5, move=2, attack_range=2, pos=(0, 0))
    t = Unit("t", "T", hp=20, atk=1, move=1, attack_range=1, pos=(2, 0), team="enemy")
    eng.add_unit(a); eng.add_unit(t)
    targets = eng.attack_targets(a)
    assert any(u.uid == "t" for u in targets)


def test_opportunity_attack_triggers():
    eng = _eng()
    p = Unit("p", "玩家", hp=20, atk=5, move=2, attack_range=1, pos=(0, 0))
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    hp_before = p.hp
    eng.move(p, (0, 1))  # 离开相邻格，触发机会攻击
    assert p.hp < hp_before, "移动离开敌方相邻格应触发机会攻击"


def test_opportunity_once_per_turn():
    eng = _eng()
    p = Unit("p", "玩家", hp=100, atk=5, move=3, attack_range=1, pos=(0, 0))
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    eng.move(p, (0, 1))  # 第一次触发
    dmg1 = 100 - p.hp
    eng.move(p, (0, 0))  # 回到原位（不离开威胁，不触发）
    eng.move(p, (0, 2))  # 再次离开，但本回合已触发过
    dmg2 = 100 - p.hp
    assert dmg2 == dmg1, "每敌方单位每回合只触发一次机会攻击"


def test_move_to_unreachable_fails():
    eng = _eng()
    u = Unit("p1", "战士", hp=20, atk=5, move=1, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    assert eng.move(u, (5, 5)) is False
    assert u.pos == (0, 0)


def test_deterministic():
    def run():
        eng = _eng()
        u = Unit("p1", "战士", hp=20, atk=5, move=2, attack_range=1, pos=(3, 3))
        eng.add_unit(u)
        return eng.reachable_cells(u)
    assert run() == run()


# ---------------------------------------------------------------------------
# 表驱动测试
# ---------------------------------------------------------------------------

# (用例名, 宽, 高, 移动力, 起点, 障碍物, 基础地形, 叠加效果, 阻挡单位,
#  {格子: 期望最小消耗}, {不可达格子})
MOVE_CASES = [
    ("四方向扩展", 5, 5, 2, (2, 2), [], {}, [], [],
     {(2, 2): 0, (3, 2): 1, (1, 2): 1, (2, 1): 1, (2, 3): 1, (4, 2): 2, (2, 4): 2},
     {(4, 4), (0, 0)}),
    ("障碍物不可通行可绕行", 4, 4, 3, (0, 0), [(1, 0), (1, 1)], {}, [], [],
     {(0, 1): 1, (0, 2): 2, (0, 3): 3, (1, 2): 3},
     {(1, 0), (1, 1), (2, 0), (2, 1)}),
    ("地形按进入格消耗", 5, 5, 2, (0, 0), [], {(1, 0): 2}, [], [],
     {(1, 0): 2, (0, 1): 1},
     {(2, 0)}),
    ("地形效果加性叠加", 5, 1, 6, (0, 0), [], {(1, 0): 2}, [((1, 0), 1), ((1, 0), 2)], [],
     {(1, 0): 5, (2, 0): 6},
     set()),
    ("地形消耗下限为1", 5, 5, 2, (0, 0), [], {(1, 0): 1}, [((1, 0), -5)], [],
     {(1, 0): 1},
     set()),
    ("剩余移动力不足不可进入", 5, 5, 1, (0, 0), [], {(1, 0): 3}, [], [],
     {(0, 1): 1},
     {(1, 0)}),
    ("不能穿过其他单位", 5, 5, 2, (0, 0), [], {}, [], [(1, 0)],
     {(0, 1): 1},
     {(1, 0), (2, 0)}),
    ("移动力为零仅起点可达", 4, 4, 0, (1, 1), [], {}, [], [],
     {(1, 1): 0},
     {(0, 1), (2, 1), (1, 0), (1, 2)}),
    ("被障碍物包围仅起点可达", 4, 4, 5, (1, 1), [(0, 1), (2, 1), (1, 0), (1, 2)], {}, [], [],
     {(1, 1): 0},
     {(0, 0), (3, 3)}),
]


@pytest.mark.parametrize(
    "name,w,h,move,start,obstacles,terrain,effects,blockers,present,absent",
    MOVE_CASES,
    ids=[c[0] for c in MOVE_CASES],
)
def test_reachable_table(name, w, h, move, start, obstacles, terrain, effects,
                         blockers, present, absent):
    eng = _eng(w, h)
    u = Unit("p", "玩家", hp=20, atk=5, move=move, attack_range=1, pos=start)
    eng.add_unit(u)
    for i, (ox, oy) in enumerate(obstacles):
        eng.add_obstacle(ox, oy)
    for (tx, ty), cost in terrain.items():
        eng.set_terrain(tx, ty, cost)
    for (ex, ey), mod in effects:
        eng.add_terrain_effect(ex, ey, mod)
    for i, (bx, by) in enumerate(blockers):
        eng.add_unit(Unit(f"b{i}", "阻挡", hp=20, atk=1, move=1, attack_range=1,
                          pos=(bx, by), team="enemy"))
    cells = eng.reachable_cells(u)
    for pos, cost in present.items():
        assert cells.get(pos) == cost, f"{name}: {pos} 消耗应为 {cost}"
    for pos in absent:
        assert pos not in cells, f"{name}: {pos} 应不可达"


def test_full_map_reachable():
    """边界：移动力足够时全图可达。"""
    eng = _eng(4, 4)
    u = Unit("p", "玩家", hp=20, atk=5, move=99, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    cells = eng.reachable_cells(u)
    assert set(cells) == {(x, y) for x in range(4) for y in range(4)}


def test_full_map_unreachable():
    """边界：全图被障碍物填满时仅起点可达。"""
    eng = _eng(4, 4)
    u = Unit("p", "玩家", hp=20, atk=5, move=99, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    for x in range(4):
        for y in range(4):
            if (x, y) != (0, 0):
                eng.add_obstacle(x, y)
    cells = eng.reachable_cells(u)
    assert set(cells) == {(0, 0)}


def test_pass_through_skill():
    """特殊技能：可穿过单位但不能停在被占据格。"""
    eng = _eng()
    u = Unit("p", "刺客", hp=20, atk=5, move=2, attack_range=1, pos=(0, 0),
             can_pass_through=True)
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(u); eng.add_unit(e)
    cells = eng.reachable_cells(u)
    assert cells.get((2, 0)) == 2, "应能穿过敌人到达 (2,0)"
    assert (1, 0) not in cells, "不能停在敌人占据的格子"
    assert eng.move(u, (1, 0)) is False


# (用例名, 敌人位置, 敌人攻击距离, 玩家起点, 玩家终点, 是否触发机会攻击)
OPP_CASES = [
    ("离开相邻威胁格触发", (1, 0), 1, (0, 0), (0, 1), True),
    ("起点不在威胁范围不触发", (3, 0), 1, (0, 0), (0, 1), False),
    ("远程威胁范围触发", (3, 0), 2, (1, 0), (1, 1), True),
    ("进入威胁格不触发", (2, 1), 1, (0, 0), (0, 1), False),
]


@pytest.mark.parametrize(
    "name,enemy_pos,enemy_range,start,target,expect_trigger",
    OPP_CASES,
    ids=[c[0] for c in OPP_CASES],
)
def test_opportunity_attack_table(name, enemy_pos, enemy_range, start, target,
                                  expect_trigger):
    eng = _eng()
    p = Unit("p", "玩家", hp=100, atk=5, move=3, attack_range=1, pos=start)
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=enemy_range, pos=enemy_pos,
             team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    hp_before = p.hp
    assert eng.move(p, target) is True
    if expect_trigger:
        assert p.hp == hp_before - e.atk, f"{name}: 应触发机会攻击"
    else:
        assert p.hp == hp_before, f"{name}: 不应触发机会攻击"


def test_opportunity_once_per_enemy_per_turn():
    """每个敌方单位每回合最多触发一次，即使多个单位离开其威胁格。"""
    eng = _eng()
    p1 = Unit("p1", "玩家1", hp=100, atk=5, move=2, attack_range=1, pos=(0, 0))
    p2 = Unit("p2", "玩家2", hp=100, atk=5, move=2, attack_range=1, pos=(1, 1))
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(p1); eng.add_unit(p2); eng.add_unit(e)
    eng.move(p1, (0, 1))  # 触发敌人的机会攻击
    eng.move(p2, (2, 1))  # 同一敌人本回合不再触发
    assert p1.hp == 97
    assert p2.hp == 100


def test_opportunity_resets_after_end_turn():
    """回合结束后机会攻击次数重置。"""
    eng = _eng()
    p = Unit("p", "玩家", hp=100, atk=5, move=2, attack_range=1, pos=(0, 0))
    e = Unit("e", "敌人", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    eng.move(p, (0, 1))
    assert p.hp == 97
    eng.end_turn()
    eng.move(p, (0, 0))  # (0,1) 不在威胁范围，不触发
    assert p.hp == 97
    eng.move(p, (0, 1))  # 新回合再次离开威胁格，重新触发
    assert p.hp == 94


# (用例名, 移动力, 攻击距离, 起点, 移动终点, 敌人位置, 移动前可攻击, 移动后可攻击)
ATTACK_AFTER_MOVE_CASES = [
    ("移动后基于终点计算", 3, 1, (0, 0), (2, 1), (3, 1), False, True),
    ("移动后脱离原目标", 2, 1, (1, 0), (3, 0), (0, 0), True, False),
    ("远程攻击基于终点", 4, 2, (0, 0), (2, 2), (3, 3), False, True),
]


@pytest.mark.parametrize(
    "name,move,atk_range,start,dest,enemy_pos,before,after",
    ATTACK_AFTER_MOVE_CASES,
    ids=[c[0] for c in ATTACK_AFTER_MOVE_CASES],
)
def test_attack_range_based_on_destination(name, move, atk_range, start, dest,
                                           enemy_pos, before, after):
    eng = _eng()
    a = Unit("a", "A", hp=20, atk=5, move=move, attack_range=atk_range, pos=start)
    t = Unit("t", "T", hp=20, atk=1, move=1, attack_range=1, pos=enemy_pos, team="enemy")
    eng.add_unit(a); eng.add_unit(t)
    assert any(u.uid == "t" for u in eng.attack_targets(a)) is before
    assert eng.move(a, dest) is True
    assert any(u.uid == "t" for u in eng.attack_targets(a)) is after, \
        f"{name}: 攻击范围应基于移动终点"


def test_deterministic_with_terrain_and_obstacles():
    """相同地图和单位配置，移动范围与攻击结果每次一致。"""
    def run():
        eng = _eng(6, 6)
        u = Unit("p", "玩家", hp=20, atk=5, move=4, attack_range=1, pos=(1, 1))
        eng.add_unit(u)
        eng.add_obstacle(2, 1)
        eng.set_terrain(1, 2, 2)
        eng.add_terrain_effect(1, 2, 1)
        return eng.reachable_cells(u), eng.snapshot()
    assert run() == run()
