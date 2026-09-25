"""回合制战棋引擎：BFS 移动范围、机会攻击、地形消耗、攻击范围。

核心不变量：
- 移动范围用 BFS 按地形消耗扩展，障碍物不可通行
- 机会攻击在离开敌方威胁格时触发，每个敌方单位每回合最多触发一次
- 地形消耗按进入格计算；多种地形效果加性叠加，进入格消耗下限为 1
- 攻击范围基于当前所在格
- 单位不能穿过其他单位（拥有 can_pass_through 技能的单位可穿过，但不能停在被占据格）
- 相同配置结果确定
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class Unit:
    uid: str
    name: str
    hp: int
    atk: int
    move: int          # 移动力
    attack_range: int  # 攻击距离
    pos: Tuple[int, int]
    team: str = "player"
    has_moved: bool = False
    can_pass_through: bool = False  # 特殊技能：可穿过其他单位（但不能停在其格子上）
    opportunity_used: Set[str] = field(default_factory=set)  # 本回合已触发机会攻击的目标 uid


class TacticsEngine:
    _DIRECTIONS: Tuple[Tuple[int, int], ...] = ((-1, 0), (1, 0), (0, -1), (0, 1))

    def __init__(self, width: int = 8, height: int = 8):
        self.width = width
        self.height = height
        self.obstacles: Set[Tuple[int, int]] = set()
        self.terrain: Dict[Tuple[int, int], int] = {}  # pos -> 基础移动消耗（默认1）
        self.terrain_effects: Dict[Tuple[int, int], List[int]] = {}  # pos -> 附加地形效果列表
        self.units: List[Unit] = []
        self.turn = 0

    def add_obstacle(self, x: int, y: int) -> None:
        self.obstacles.add((x, y))

    def set_terrain(self, x: int, y: int, cost: int) -> None:
        self.terrain[(x, y)] = cost

    def add_terrain_effect(self, x: int, y: int, modifier: int) -> None:
        """在格子上叠加一个地形效果（加性，可为负）。"""
        self.terrain_effects.setdefault((x, y), []).append(modifier)

    def add_unit(self, u: Unit) -> None:
        self.units.append(u)

    def get_unit(self, uid: str) -> Optional[Unit]:
        for u in self.units:
            if u.uid == uid:
                return u
        return None

    def _unit_at(self, pos: Tuple[int, int]) -> Optional[Unit]:
        for u in self.units:
            if u.pos == pos and u.hp > 0:
                return u
        return None

    def _terrain_cost(self, pos: Tuple[int, int]) -> int:
        """进入格消耗 = 基础消耗 + 所有附加效果之和，下限为 1。"""
        base = self.terrain.get(pos, 1)
        extra = sum(self.terrain_effects.get(pos, ()))
        return max(1, base + extra)

    def reachable_cells(self, unit: Unit) -> Dict[Tuple[int, int], int]:
        """BFS 从起点按进入格地形消耗扩展，返回可达格子及最小消耗。

        障碍物完全不可通行；其他单位占据的格子不可通行（拥有
        can_pass_through 技能时可穿过但不能停留）；剩余移动力不足以
        进入的格子不可达。
        """
        start = unit.pos
        dist = {start: 0}
        q = deque([start])
        while q:
            x, y = q.popleft()
            d = dist[(x, y)]
            for dx, dy in self._DIRECTIONS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < self.width and 0 <= ny < self.height):
                    continue
                if (nx, ny) in self.obstacles:
                    continue
                occupant = self._unit_at((nx, ny))
                if occupant is not None and (nx, ny) != start and not unit.can_pass_through:
                    continue  # 不能穿过其他单位
                cost = self._terrain_cost((nx, ny))
                nd = d + cost
                if nd <= unit.move and (nd < dist.get((nx, ny), float("inf"))):
                    dist[(nx, ny)] = nd
                    q.append((nx, ny))
        # 不能停在其他单位占据的格子上
        return {pos: d for pos, d in dist.items()
                if pos == start or self._unit_at(pos) is None}

    def can_reach(self, unit: Unit, target: Tuple[int, int]) -> bool:
        return target in self.reachable_cells(unit)

    def attack_targets(self, unit: Unit) -> List[Unit]:
        """基于当前位置计算攻击范围内的敌方单位。"""
        targets = []
        for u in self.units:
            if u.team == unit.team or u.hp <= 0:
                continue
            dx = abs(u.pos[0] - unit.pos[0])
            dy = abs(u.pos[1] - unit.pos[1])
            if dx + dy <= unit.attack_range:
                targets.append(u)
        return targets

    def move(self, unit: Unit, target: Tuple[int, int]) -> bool:
        if not self.can_reach(unit, target):
            return False
        # 检查机会攻击：离开敌方威胁格时触发，每个敌方单位每回合最多一次
        for enemy in self.units:
            if enemy.team == unit.team or enemy.hp <= 0:
                continue
            if enemy.opportunity_used:
                continue
            edx = abs(enemy.pos[0] - unit.pos[0])
            edy = abs(enemy.pos[1] - unit.pos[1])
            if edx + edy <= enemy.attack_range:  # 处于敌方威胁范围内
                enemy.opportunity_used.add(unit.uid)
                unit.hp -= enemy.atk
                if unit.hp <= 0:
                    return False
        unit.pos = target
        unit.has_moved = True
        return True

    def attack(self, attacker: Unit, target: Unit) -> int:
        dmg = max(1, attacker.atk)
        target.hp -= dmg
        return dmg

    def end_turn(self) -> None:
        self.turn += 1
        for u in self.units:
            u.opportunity_used.clear()
            u.has_moved = False

    def snapshot(self) -> dict:
        return {
            "turn": self.turn,
            "units": [{"uid": u.uid, "hp": u.hp, "pos": u.pos, "has_moved": u.has_moved}
                      for u in self.units],
        }
