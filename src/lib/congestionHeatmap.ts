import type { Drone, Node } from '@/types/database';

type LatLngBoundsLike = {
  getSouth: () => number;
  getWest: () => number;
  getNorth: () => number;
  getEast: () => number;
};

export type HeatmapCell = {
  bounds: [[number, number], [number, number]];
  congestion: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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

const influence = (distanceKm: number, scaleKm: number): number => {
  if (scaleKm <= 0) return 0;
  return Math.exp(-distanceKm / scaleKm);
};

export const buildHeatmapCells = (params: {
  bounds: LatLngBoundsLike;
  rows?: number;
  cols?: number;
  nodes: Node[];
  drones: Drone[];
}): HeatmapCell[] => {
  const { bounds, nodes, drones } = params;
  const rows = params.rows ?? 20;
  const cols = params.cols ?? 20;

  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();

  const latStep = (north - south) / rows;
  const lngStep = (east - west) / cols;

  const cells: HeatmapCell[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const latMin = south + r * latStep;
      const latMax = latMin + latStep;
      const lngMin = west + c * lngStep;
      const lngMax = lngMin + lngStep;
      const centerLat = (latMin + latMax) / 2;
      const centerLng = (lngMin + lngMax) / 2;

      let nodeScore = 0;
      for (const node of nodes) {
        if (node.capacity <= 0) continue;
        const ratio = clamp(node.current_load / node.capacity, 0, 1);
        const dist = haversineKm(centerLat, centerLng, node.lat, node.lng);
        nodeScore += ratio * influence(dist, 2.5);
      }

      let droneScore = 0;
      for (const drone of drones) {
        const dist = haversineKm(centerLat, centerLng, drone.lat, drone.lng);
        droneScore += influence(dist, 1.5) * 0.08;
      }

      const congestion = clamp(nodeScore + droneScore, 0, 1);
      cells.push({
        bounds: [
          [latMin, lngMin],
          [latMax, lngMax],
        ],
        congestion,
      });
    }
  }

  return cells;
};

export const getHeatmapColor = (congestion: number): string => {
  const clamped = clamp(congestion, 0, 1);
  const hue = 120 * (1 - clamped);
  return `hsl(${hue} 85% 50%)`;
};
