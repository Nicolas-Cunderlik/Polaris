#!/usr/bin/env python3
"""
Grid-based congestion heat map + A* pathfinding demo.

This is a standalone Python example aligned with the project's drone routing concept:
- Each grid cell has a congestion level [0.0, 1.0].
- A* treats high congestion as high traversal cost.
- The path may be longer geometrically if it reduces total time cost.
"""

from __future__ import annotations

import argparse
import heapq
import math
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

Grid = List[List[float]]
Point = Tuple[int, int]

GRID_SIZE = 20
BASE_COST = 1.0
PENALTY_MULTIPLIER = 4.0
HIGH_CONGESTION_THRESHOLD = 0.8
HIGH_PENALTY = 50.0


@dataclass(frozen=True)
class Node:
    f: float
    g: float
    position: Point


def generate_congestion_grid(size: int, seed: int = 42) -> Grid:
    rng = random.Random(seed)
    grid = [[0.05 + rng.random() * 0.2 for _ in range(size)] for _ in range(size)]

    # Create a high congestion block in the center to force a detour.
    for r in range(7, 13):
        for c in range(6, 14):
            grid[r][c] = 0.92

    # Add a moderate congestion band near the top to create tradeoffs.
    for c in range(2, size - 2):
        grid[4][c] = 0.55

    return grid


def traversal_cost(congestion: float) -> float:
    base = BASE_COST + (congestion * PENALTY_MULTIPLIER)
    if congestion > HIGH_CONGESTION_THRESHOLD:
        return base + HIGH_PENALTY
    return base


def heuristic(a: Point, b: Point) -> float:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def neighbors(point: Point, size: int) -> List[Point]:
    r, c = point
    candidates = [(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)]
    return [(nr, nc) for nr, nc in candidates if 0 <= nr < size and 0 <= nc < size]


def a_star(grid: Grid, start: Point, goal: Point) -> Tuple[List[Point], float]:
    size = len(grid)
    open_heap: List[Node] = []
    heapq.heappush(open_heap, Node(heuristic(start, goal), 0.0, start))

    came_from: Dict[Point, Optional[Point]] = {start: None}
    g_score: Dict[Point, float] = {start: 0.0}

    while open_heap:
        current = heapq.heappop(open_heap)
        if current.position == goal:
            return reconstruct_path(came_from, goal), g_score[goal]

        for neighbor in neighbors(current.position, size):
            r, c = neighbor
            step_cost = traversal_cost(grid[r][c])
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
    grid: Grid,
    path: List[Point],
    start: Point,
    goal: Point,
    show_heatmap: bool,
    show_path: bool,
) -> str:
    size = len(grid)
    path_set = set(path) if show_path else set()
    lines: List[str] = []

    for r in range(size):
        row_chars: List[str] = []
        for c in range(size):
            pos = (r, c)
            if pos == start:
                row_chars.append('S')
            elif pos == goal:
                row_chars.append('G')
            elif pos in path_set:
                row_chars.append('.')
            elif show_heatmap and grid[r][c] > HIGH_CONGESTION_THRESHOLD:
                row_chars.append('#')
            else:
                row_chars.append(' ')
        lines.append(''.join(row_chars))

    return '\n'.join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description='A* pathfinding with congestion heat map.')
    parser.add_argument('--hide-heatmap', dest='show_heatmap', action='store_false', default=True)
    parser.add_argument('--hide-path', dest='show_path', action='store_false', default=True)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    grid = generate_congestion_grid(GRID_SIZE, seed=args.seed)
    start = (1, 1)
    goal = (GRID_SIZE - 2, GRID_SIZE - 2)

    path, total_cost = a_star(grid, start, goal)
    physical_steps = max(0, len(path) - 1)

    print('Congestion A* Demo')
    print(f'Grid: {GRID_SIZE}x{GRID_SIZE} | Start: {start} | Goal: {goal}')
    print(f'Path length (steps): {physical_steps} | Total time cost: {total_cost:.2f}')
    print('Legend: S=Start, G=Goal, .=Path, #=High Congestion')
    print(render_grid(grid, path, start, goal, args.show_heatmap, args.show_path))


if __name__ == '__main__':
    main()
