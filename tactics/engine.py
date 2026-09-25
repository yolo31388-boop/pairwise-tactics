"""回合制战棋引擎：BFS 移动范围、机会攻击、地形消耗、攻击范围。

核心不变量：
- 移动范围用 BFS 按地形消耗扩展，障碍物不可通行
- 机会攻击在离开威胁格时触发，每敌方单位每回合一次
- 地形消耗按进入格计算
- 攻击范围基于当前所在格
- 单位不能穿过其他单位
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
    opportunity_used: Set[str] = field(default_factory=set)  # 本回合已触发机会攻击的目标 uid


class TacticsEngine:
    def __init__(self, width: int = 8, height: int = 8):
        self.width = width
        self.height = height
        self.obstacles: Set[Tuple[int, int]] = set()
        self.terrain: Dict[Tuple[int, int], int] = {}  # pos -> 移动消耗（默认1）
        self.units: List[Unit] = []
        self.turn = 0

    def add_obstacle(self, x: int, y: int) -> None:
        self.obstacles.add((x, y))

    def set_terrain(self, x: int, y: int, cost: int) -> None:
        self.terrain[(x, y)] = cost

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
        return self.terrain.get(pos, 1)

    def reachable_cells(self, unit: Unit) -> Dict[Tuple[int, int], int]:
        """BFS 计算可达格子及最小消耗。BUG：漏掉右方向扩展。"""
        start = unit.pos
        dist = {start: 0}
        q = deque([start])
        # BUG: 只检查了上、下、左，漏掉了右方向 (1, 0)
        directions = [(-1, 0), (1, 0), (0, -1)]  # 应该是 [(-1,0),(1,0),(0,-1),(0,1)]
        while q:
            x, y = q.popleft()
            d = dist[(x, y)]
            for dx, dy in directions:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < self.width and 0 <= ny < self.height):
                    continue
                if (nx, ny) in self.obstacles:
                    continue
                if self._unit_at((nx, ny)) and (nx, ny) != start:
                    continue  # 不能穿过其他单位
                cost = self._terrain_cost((nx, ny))
                nd = d + cost
                if nd <= unit.move and (nd < dist.get((nx, ny), float("inf"))):
                    dist[(nx, ny)] = nd
                    q.append((nx, ny))
        return dist

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
        # 检查机会攻击：离开敌方威胁格时触发
        for enemy in self.units:
            if enemy.team == unit.team or enemy.hp <= 0:
                continue
            if unit.uid in enemy.opportunity_used:
                continue
            edx = abs(enemy.pos[0] - unit.pos[0])
            edy = abs(enemy.pos[1] - unit.pos[1])
            if edx + edy <= 1:  # 相邻即威胁
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
