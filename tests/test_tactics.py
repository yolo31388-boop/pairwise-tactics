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


# ---------------- 表驱动测试 ----------------


@pytest.mark.parametrize(
    "start,move,expected",
    [
        # move=0：只有起点
        ((2, 2), 0, {(2, 2): 0}),
        # move=1：十字
        ((2, 2), 1, {(2, 2): 0, (1, 2): 1, (3, 2): 1, (2, 1): 1, (2, 3): 1}),
        # move=2：菱形 13 格
        ((2, 2), 2, {
            (2, 2): 0,
            (1, 2): 1, (3, 2): 1, (2, 1): 1, (2, 3): 1,
            (0, 2): 2, (4, 2): 2, (2, 0): 2, (2, 4): 2,
            (1, 1): 2, (1, 3): 2, (3, 1): 2, (3, 3): 2,
        }),
        # 角落：越界格被裁剪
        ((0, 0), 1, {(0, 0): 0, (1, 0): 1, (0, 1): 1}),
    ],
)
def test_bfs_range_table(start, move, expected):
    eng = _eng(5, 5)
    u = Unit("p", "P", hp=20, atk=5, move=move, attack_range=1, pos=start)
    eng.add_unit(u)
    assert eng.reachable_cells(u) == expected


@pytest.mark.parametrize(
    "obstacles,reachable,unreachable",
    [
        # 单个障碍：本身不可达，邻格仍可绕
        ([(1, 0)], [(0, 1), (1, 1), (2, 1)], [(1, 0)]),
        # 整列墙封死：墙右侧全部不可达
        ([(2, y) for y in range(5)], [(1, 0), (1, 4), (0, 4)],
         [(2, 0), (3, 0), (4, 4)]),
        # 四面包围：只剩起点
        ([(1, 0), (0, 1)], [], [(1, 0), (0, 1), (1, 1)]),
    ],
)
def test_obstacle_table(obstacles, reachable, unreachable):
    eng = _eng(5, 5)
    u = Unit("p", "P", hp=20, atk=5, move=10, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    for x, y in obstacles:
        eng.add_obstacle(x, y)
    cells = eng.reachable_cells(u)
    for pos in reachable:
        assert pos in cells, f"{pos} 应可达"
    for pos in unreachable:
        assert pos not in cells, f"{pos} 应不可达"


@pytest.mark.parametrize(
    "terrain,extra_effects,move,expected_costs,unreachable",
    [
        # 单一地形：进入格消耗 2
        ({(1, 0): 2}, {}, 2, {(1, 0): 2, (2, 0): None}, []),
        # 基础 2 + 效果 1 = 3，叠加后恰好够不着下一格
        ({(1, 0): 2}, [((1, 0), 1)], 3, {(1, 0): 3}, [(2, 0)]),
        # 基础 2 + 效果 1 + 效果 1 = 4；(2,0) 绕行消耗 4 恰好可达
        ({(1, 0): 2}, [((1, 0), 1), ((1, 0), 1)], 4, {(1, 0): 4, (2, 0): 4}, []),
        # 负效果降低消耗：基础 3 - 2 = 1
        ({(1, 0): 3}, [((1, 0), -2)], 2, {(1, 0): 1, (2, 0): 2}, []),
        # 消耗下限为 0：基础 1 - 5 = 0
        ({(1, 0): 1}, [((1, 0), -5)], 0, {(1, 0): 0}, []),
    ],
)
def test_terrain_stacking_table(terrain, extra_effects, move, expected_costs, unreachable):
    eng = _eng(5, 5)
    u = Unit("p", "P", hp=20, atk=5, move=move, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    for (x, y), cost in terrain.items():
        eng.set_terrain(x, y, cost)
    for (pos, delta) in extra_effects:
        eng.add_terrain_effect(pos[0], pos[1], delta)
    cells = eng.reachable_cells(u)
    for pos, cost in expected_costs.items():
        if cost is None:
            assert pos not in cells
        else:
            assert cells.get(pos) == cost, f"{pos} 消耗应为 {cost}"
    for pos in unreachable:
        assert pos not in cells


@pytest.mark.parametrize(
    "start,enemy_pos,enemy_atk,should_trigger",
    [
        ((0, 0), (1, 0), 3, True),    # 起点在敌方威胁格内，离开触发
        ((0, 0), (2, 0), 3, False),   # 起点不在威胁格内，不触发
        ((0, 0), (0, 2), 3, False),   # 距离 2 > 敌方攻击范围 1，不触发
    ],
)
def test_opportunity_trigger_table(start, enemy_pos, enemy_atk, should_trigger):
    eng = _eng()
    p = Unit("p", "P", hp=50, atk=5, move=2, attack_range=1, pos=start)
    e = Unit("e", "E", hp=20, atk=enemy_atk, move=1, attack_range=1, pos=enemy_pos, team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    hp_before = p.hp
    eng.move(p, (0, 1) if start != (0, 1) else (0, 0))
    if should_trigger:
        assert p.hp == hp_before - enemy_atk
    else:
        assert p.hp == hp_before


def test_opportunity_per_enemy_independent():
    """每个敌方单位各自独立触发一次。"""
    eng = _eng()
    p = Unit("p", "P", hp=50, atk=5, move=2, attack_range=1, pos=(1, 1))
    e1 = Unit("e1", "E1", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    e2 = Unit("e2", "E2", hp=20, atk=4, move=1, attack_range=1, pos=(0, 1), team="enemy")
    eng.add_unit(p); eng.add_unit(e1); eng.add_unit(e2)
    eng.move(p, (2, 2))
    assert p.hp == 50 - 3 - 4, "两个敌方单位应各触发一次"


def test_opportunity_reset_on_end_turn():
    """回合结束后机会攻击次数重置。"""
    eng = _eng()
    p = Unit("p", "P", hp=50, atk=5, move=2, attack_range=1, pos=(0, 0))
    e = Unit("e", "E", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team="enemy")
    eng.add_unit(p); eng.add_unit(e)
    eng.move(p, (0, 1))
    assert p.hp == 47
    eng.end_turn()
    eng.move(p, (0, 0))
    eng.move(p, (0, 1))
    assert p.hp == 44, "新回合应能再次触发"


@pytest.mark.parametrize(
    "dest,expected_in_range",
    [
        ((2, 0), True),   # 移动到 (2,0) 后，(4,0) 距离 2 在射程内
        ((0, 2), False),  # 移动到 (0,2) 后，(4,0) 距离 6 超出射程
    ],
)
def test_attack_range_based_on_destination(dest, expected_in_range):
    """移动后攻击范围必须基于终点位置计算。"""
    eng = _eng()
    a = Unit("a", "A", hp=20, atk=5, move=2, attack_range=2, pos=(0, 0))
    t = Unit("t", "T", hp=20, atk=1, move=1, attack_range=1, pos=(4, 0), team="enemy")
    eng.add_unit(a); eng.add_unit(t)
    assert not any(u.uid == "t" for u in eng.attack_targets(a))  # 移动前不在射程
    assert eng.move(a, dest)
    hits = [u.uid for u in eng.attack_targets(a)]
    assert ("t" in hits) is expected_in_range


@pytest.mark.parametrize(
    "blocker_team",
    ["player", "enemy"],
)
def test_cannot_pass_through_any_unit(blocker_team):
    """无论敌我都不能穿过（无特殊技能）。"""
    eng = _eng(5, 5)
    u = Unit("p", "P", hp=20, atk=5, move=2, attack_range=1, pos=(0, 0))
    blocker = Unit("b", "B", hp=20, atk=3, move=1, attack_range=1, pos=(1, 0), team=blocker_team)
    eng.add_unit(u); eng.add_unit(blocker)
    cells = eng.reachable_cells(u)
    assert (1, 0) not in cells
    assert (2, 0) not in cells  # 直线被挡住，move=2 不够绕行
    assert (0, 1) in cells      # 其他方向不受影响


def test_full_map_reachable():
    """边界：移动力足够时全图可达。"""
    eng = _eng(6, 6)
    u = Unit("p", "P", hp=20, atk=5, move=99, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    cells = eng.reachable_cells(u)
    assert len(cells) == 36
    assert cells[(5, 5)] == 10  # 曼哈顿距离


def test_full_map_unreachable():
    """边界：被障碍完全包围时只有起点可达。"""
    eng = _eng(6, 6)
    u = Unit("p", "P", hp=20, atk=5, move=99, attack_range=1, pos=(3, 3))
    eng.add_unit(u)
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        eng.add_obstacle(3 + dx, 3 + dy)
    cells = eng.reachable_cells(u)
    assert cells == {(3, 3): 0}


def test_insufficient_move_cell_unreachable():
    """剩余移动力不足以支付的格不可达。"""
    eng = _eng(5, 5)
    u = Unit("p", "P", hp=20, atk=5, move=2, attack_range=1, pos=(0, 0))
    eng.add_unit(u)
    eng.set_terrain(1, 0, 2)
    eng.set_terrain(2, 0, 1)
    cells = eng.reachable_cells(u)
    assert cells.get((1, 0)) == 2
    assert (2, 0) not in cells  # 2+1=3 > move=2


def test_deterministic_with_terrain_and_obstacles():
    """相同地图和单位配置，多次计算结果一致。"""
    def run():
        eng = _eng(6, 6)
        u = Unit("p", "P", hp=20, atk=5, move=4, attack_range=1, pos=(1, 1))
        eng.add_unit(u)
        eng.add_obstacle(2, 2)
        eng.set_terrain(3, 1, 2)
        eng.add_terrain_effect(3, 1, 1)
        return eng.reachable_cells(u)
    assert run() == run()
