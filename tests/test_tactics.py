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
