#!/usr/bin/env python3
"""
Grid-based spatial heat map + A* pathfinding demo for drone navigation.

Cost layers:
- Dynamic drone density (congestion)
- Charger proximity incentive (negative cost)
- Safety radius penalty (exponential) when far from nearest charger
"""

from __future__ import annotations

import heapq
import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

Point = Tuple[int, int]
Grid = List[List[float]]

GRID_SIZE = 20
BASE_COST = 1.0
DRONE_DENSITY_WEIGHT = 3.5
CHARGER_PROXIMITY_WEIGHT = 2.5
CRITICAL_CONGESTION = 0.8
CRITICAL_PENALTY = 30.0

SAFETY_RADIUS = 6.0
SAFETY_PENALTY_SCALE = 2.0

DRONE_HEAT_RADIUS = 4.0
CHARGER_INCENTIVE_RADIUS = 5.0


def euclidean(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def decay(distance: float, radius: float) -> float:
    if radius <= 0:
        return 0.0
    if distance > radius:
        return 0.0
    return 1.0 - (distance / radius)


def drone_density(point: Point, drones: List[Point]) -> float:
    total = 0.0
    for drone in drones:
        total += decay(euclidean(point, drone), DRONE_HEAT_RADIUS)
    return min(1.0, total)


def charger_proximity(point: Point, chargers: List[Point]) -> float:
    if not chargers:
        return 0.0
    best = 0.0
    for charger in chargers:
        best = max(best, decay(euclidean(point, charger), CHARGER_INCENTIVE_RADIUS))
    return best


def distance_penalty(point: Point, chargers: List[Point]) -> float:
    if not chargers:
        return math.exp(1.0)
    nearest = min(euclidean(point, charger) for charger in chargers)
    if nearest <= SAFETY_RADIUS:
        return 0.0
    overflow = (nearest - SAFETY_RADIUS) / max(0.1, SAFETY_PENALTY_SCALE)
    return math.exp(overflow) - 1.0


def traversal_cost(point: Point, drones: List[Point], chargers: List[Point]) -> float:
    density = drone_density(point, drones)
    proximity = charger_proximity(point, chargers)
    penalty = distance_penalty(point, chargers)

    cost = (
        BASE_COST
        + DRONE_DENSITY_WEIGHT * density
        - CHARGER_PROXIMITY_WEIGHT * proximity
        + penalty
    )

    if density > CRITICAL_CONGESTION:
        cost += CRITICAL_PENALTY

    return max(0.1, cost)


@dataclass(frozen=True)
class Node:
    f: float
    g: float
    position: Point


def neighbors(point: Point, size: int) -> List[Point]:
    r, c = point
    candidates = [(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)]
    return [(nr, nc) for nr, nc in candidates if 0 <= nr < size and 0 <= nc < size]


def heuristic(a: Point, b: Point) -> float:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def a_star(
    size: int,
    start: Point,
    goal: Point,
    drones: List[Point],
    chargers: List[Point],
) -> Tuple[List[Point], float]:
    open_heap: List[Node] = []
    heapq.heappush(open_heap, Node(heuristic(start, goal), 0.0, start))

    came_from: Dict[Point, Optional[Point]] = {start: None}
    g_score: Dict[Point, float] = {start: 0.0}

    while open_heap:
        current = heapq.heappop(open_heap)
        if current.position == goal:
            return reconstruct_path(came_from, goal), g_score[goal]

        for neighbor in neighbors(current.position, size):
            step_cost = traversal_cost(neighbor, drones, chargers)
            tentative_g = g_score[current.position] + step_cost
            if tentative_g < g_score.get(neighbor, math.inf):
                came_from[neighbor] = current.position
                g_score[neighbor] = tentative_g
                f = tentative_g + heuristic(neighbor, goal)
                heapq.heappush(open_heap, Node(f, tentative_g, neighbor))

    return [], math.inf


def reconstruct_path(came_from: Dict[Point, Optional[Point]], goal: Point) -> List[Point]:
    path: List[Point] = []
    current: Optional[Point] = goal
    while current is not None:
        path.append(current)
        current = came_from.get(current)
    return list(reversed(path))


def render_grid(
    size: int,
    start: Point,
    goal: Point,
    chargers: List[Point],
    drones: List[Point],
    path: List[Point],
) -> str:
    path_set = set(path)
    chargers_set = set(chargers)

    lines: List[str] = []
    for r in range(size):
        row_chars: List[str] = []
        for c in range(size):
            pos = (r, c)
            if pos == start:
                row_chars.append('S')
            elif pos == goal:
                row_chars.append('G')
            elif pos in chargers_set:
                row_chars.append('C')
            elif pos in path_set:
                row_chars.append('.')
            else:
                density = drone_density(pos, drones)
                if density > CRITICAL_CONGESTION:
                    row_chars.append('H')
                else:
                    row_chars.append(' ')
        lines.append(''.join(row_chars))
    return '\n'.join(lines)


def main() -> None:
    rng = random.Random(7)

    chargers = [(3, 3), (10, 2), (15, 14)]
    drones = [(6, 11), (7, 12), (8, 10), (9, 11), (12, 5)]

    # Slightly randomize drones to show a cluster.
    drones = [
        (min(GRID_SIZE - 1, max(0, r + rng.randint(-1, 1))),
         min(GRID_SIZE - 1, max(0, c + rng.randint(-1, 1))))
        for r, c in drones
    ]

    start = (1, 1)
    goal = (GRID_SIZE - 2, GRID_SIZE - 2)

    path, total_cost = a_star(GRID_SIZE, start, goal, drones, chargers)

    print('Spatial Heat Map A* Demo')
    print(f'Grid: {GRID_SIZE}x{GRID_SIZE} | Start: {start} | Goal: {goal}')
    print(f'Path length: {max(0, len(path) - 1)} | Total cost: {total_cost:.2f}')
    print('Legend: S=Start, G=Goal, C=Charger, H=High congestion, .=Path')
    print(render_grid(GRID_SIZE, start, goal, chargers, drones, path))


if __name__ == '__main__':
    main()
