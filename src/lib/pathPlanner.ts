import type { Drone, Node } from '@/types/database';
import { estimatePathCost } from '@/lib/routeModel';

export type Waypoint = { lat: number; lng: number };

export interface PlanRouteOptions {
  start: Waypoint;
  target: Waypoint;
  drone: Drone;
  nodes: Node[];
  drones: Drone[];
}

export interface PlannedRoute {
  waypoints: Waypoint[];
  intent: 'mission' | 'charging';
  targetNodeId?: string | null;
}

type RoutePoint = {
  id: string;
  lat: number;
  lng: number;
  kind: 'start' | 'target' | 'node';
  node?: Node;
};

const DENSITY_RADIUS_KM = 2;
const MAX_CONGESTION_FOR_INTERMEDIATE = 0.95;

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const congestionRatio = (node: Node): number => {
  if (node.capacity <= 0) return 1;
  return Math.min(1, node.current_load / node.capacity);
};

const computeDroneDensity = (point: Waypoint, drones: Drone[], droneId: string): number => {
  const others = drones.filter(drone => drone.id !== droneId);
  if (others.length === 0) return 0;

  const nearby = others.filter(
    drone => calculateDistance(point.lat, point.lng, drone.lat, drone.lng) <= DENSITY_RADIUS_KM
  ).length;
  return nearby / others.length;
};

const scoreEdge = (
  distanceKm: number,
  congestion: number,
  batteryLevel: number,
  droneDensity: number,
  batteryRangeKm: number
): number => {
  const baseCost = estimatePathCost({
    distanceKm,
    congestion,
    batteryLevel,
    droneDensity,
  });

  const distancePenalty = distanceKm / Math.max(1, batteryRangeKm);
  const congestionPenalty = congestion > 0.85 ? 2.5 : 1;
  const cost = baseCost * (1 + distancePenalty) * congestionPenalty;

  return Math.max(0.001, cost);
};

export const selectChargingTarget = (
  drone: Drone,
  nodes: Node[],
  drones: Drone[]
): Node | null => {
  const candidates = nodes.filter(
    node => node.capacity > 0 && node.current_load < node.capacity
  );
  if (candidates.length === 0) return null;

  let bestNode: Node | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const batteryRangeKm = Math.max(1, drone.battery / 0.5);

  for (const node of candidates) {
    const distance = calculateDistance(drone.lat, drone.lng, node.lat, node.lng);
    if (distance > batteryRangeKm) continue;

    const congestion = congestionRatio(node);
    const density = computeDroneDensity({ lat: node.lat, lng: node.lng }, drones, drone.id);
    const score = scoreEdge(distance, congestion, drone.battery / 100, density, batteryRangeKm);

    if (score < bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
};

export const planRoute = async (options: PlanRouteOptions): Promise<Waypoint[]> => {
  const batteryRangeKm = Math.max(1, options.drone.battery / 0.5);
  const maxLegKm = Math.min(75, batteryRangeKm);

  const points: RoutePoint[] = [
    {
      id: 'start',
      lat: options.start.lat,
      lng: options.start.lng,
      kind: 'start',
    },
    {
      id: 'target',
      lat: options.target.lat,
      lng: options.target.lng,
      kind: 'target',
    },
  ];

  for (const node of options.nodes) {
    if (node.capacity <= 0) continue;
    const congestion = congestionRatio(node);
    if (congestion >= MAX_CONGESTION_FOR_INTERMEDIATE) continue;
    points.push({
      id: node.id,
      lat: node.lat,
      lng: node.lng,
      kind: 'node',
      node,
    });
  }

  const distances = new Array(points.length).fill(Number.POSITIVE_INFINITY);
  const prev = new Array(points.length).fill(-1);
  const visited = new Array(points.length).fill(false);

  distances[0] = 0;

  for (let i = 0; i < points.length; i += 1) {
    let currentIndex = -1;
    let currentBest = Number.POSITIVE_INFINITY;

    for (let j = 0; j < points.length; j += 1) {
      if (!visited[j] && distances[j] < currentBest) {
        currentBest = distances[j];
        currentIndex = j;
      }
    }

    if (currentIndex === -1) break;
    if (currentIndex === 1) break;

    visited[currentIndex] = true;

    for (let neighborIndex = 0; neighborIndex < points.length; neighborIndex += 1) {
      if (neighborIndex === currentIndex) continue;

      const from = points[currentIndex];
      const to = points[neighborIndex];
      const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);

      if (distance > maxLegKm || distance > batteryRangeKm) continue;

      const congestion = to.node ? congestionRatio(to.node) : 0;
      const density = computeDroneDensity({ lat: to.lat, lng: to.lng }, options.drones, options.drone.id);
      const edgeCost = scoreEdge(distance, congestion, options.drone.battery / 100, density, batteryRangeKm);
      const candidate = distances[currentIndex] + edgeCost;

      if (candidate < distances[neighborIndex]) {
        distances[neighborIndex] = candidate;
        prev[neighborIndex] = currentIndex;
      }
    }
  }

  if (prev[1] === -1) {
    return [{ lat: options.target.lat, lng: options.target.lng }];
  }

  const path: Waypoint[] = [];
  let index = 1;
  while (index !== 0 && index !== -1) {
    const point = points[index];
    path.push({ lat: point.lat, lng: point.lng });
    index = prev[index];
  }

  return path.reverse();
};
