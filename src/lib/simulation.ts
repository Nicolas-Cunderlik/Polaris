// Drone simulation engine
import type { Drone, Node } from '@/types/database';
import { updateDronePosition, createTransaction, updateNodeLoad } from '@/db/api';
import { planRoute, selectChargingTarget, type PlannedRoute, type Waypoint } from '@/lib/pathPlanner';

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
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

// Find nearest charging node
export const findNearestNode = (
  droneLat: number,
  droneLng: number,
  nodes: Node[]
): Node | null => {
  if (nodes.length === 0) return null;

  let nearest = nodes[0];
  let minDistance = calculateDistance(droneLat, droneLng, nearest.lat, nearest.lng);

  for (const node of nodes) {
    // Skip nodes at full capacity
    if (node.current_load >= node.capacity) continue;

    const distance = calculateDistance(droneLat, droneLng, node.lat, node.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = node;
    }
  }

  return nearest.current_load < nearest.capacity ? nearest : null;
};

// Move drone towards destination
export const moveDrone = (
  drone: Drone,
  targetLat: number,
  targetLng: number,
  speed: number = 0.001 // degrees per update (~100m)
): { lat: number; lng: number; arrived: boolean } => {
  const distance = calculateDistance(drone.lat, drone.lng, targetLat, targetLng);
  
  if (distance < 0.1) {
    // Arrived at destination
    return { lat: targetLat, lng: targetLng, arrived: true };
  }

  // Calculate direction
  const latDiff = targetLat - drone.lat;
  const lngDiff = targetLng - drone.lng;
  const angle = Math.atan2(lngDiff, latDiff);

  // Move towards target
  const newLat = drone.lat + Math.cos(angle) * speed;
  const newLng = drone.lng + Math.sin(angle) * speed;

  return { lat: newLat, lng: newLng, arrived: false };
};

// Calculate battery drain based on distance traveled
export const calculateBatteryDrain = (distance: number): number => {
  // Drain ~0.5% battery per km
  return distance * 0.5;
};

const routeCache = new Map<string, PlannedRoute>();

const generateMissionTarget = (drone: Drone): Waypoint => {
  return {
    lat: drone.lat + (Math.random() - 0.5) * 0.1,
    lng: drone.lng + (Math.random() - 0.5) * 0.1,
  };
};

const resolveChargingRoute = async (
  drone: Drone,
  nodes: Node[],
  drones: Drone[]
): Promise<PlannedRoute | null> => {
  const cached = routeCache.get(drone.id);
  if (cached?.intent === 'charging' && cached.waypoints.length > 0 && cached.targetNodeId) {
    const targetNode = nodes.find(node => node.id === cached.targetNodeId);
    if (targetNode && targetNode.current_load < targetNode.capacity) {
      return cached;
    }
  }

  const targetNode = selectChargingTarget(drone, nodes, drones);
  if (!targetNode) return null;

  const waypoints = await planRoute({
    start: { lat: drone.lat, lng: drone.lng },
    target: { lat: targetNode.lat, lng: targetNode.lng },
    drone,
    nodes,
    drones,
  });

  const plannedRoute: PlannedRoute = {
    waypoints,
    intent: 'charging',
    targetNodeId: targetNode.id,
  };

  routeCache.set(drone.id, plannedRoute);
  return plannedRoute;
};

const resolveMissionRoute = async (
  drone: Drone,
  nodes: Node[],
  drones: Drone[]
): Promise<PlannedRoute> => {
  const cached = routeCache.get(drone.id);
  if (cached?.intent === 'mission' && cached.waypoints.length > 0) {
    return cached;
  }

  const target: Waypoint =
    drone.destination_lat !== null && drone.destination_lng !== null
      ? { lat: drone.destination_lat, lng: drone.destination_lng }
      : generateMissionTarget(drone);

  const waypoints = await planRoute({
    start: { lat: drone.lat, lng: drone.lng },
    target,
    drone,
    nodes,
    drones,
  });

  const plannedRoute: PlannedRoute = {
    waypoints,
    intent: 'mission',
  };

  routeCache.set(drone.id, plannedRoute);
  return plannedRoute;
};

const advanceAlongRoute = async (
  drone: Drone,
  plannedRoute: PlannedRoute,
  nodes: Node[],
  movingStatus: 'flying' | 'en_route'
): Promise<void> => {
  const next = plannedRoute.waypoints[0];
  if (!next) {
    routeCache.delete(drone.id);
    await updateDronePosition(drone.id, drone.lat, drone.lng, drone.battery, 'idle', {
      waypoints: [],
      intent: null,
    });
    return;
  }

  const { lat, lng, arrived } = moveDrone(drone, next.lat, next.lng);
  const distanceTraveled = calculateDistance(drone.lat, drone.lng, lat, lng);
  const batteryDrain = calculateBatteryDrain(distanceTraveled);
  const newBattery = Math.max(0, drone.battery - batteryDrain);

  if (arrived) {
    plannedRoute.waypoints.shift();
  }

  if (plannedRoute.waypoints.length === 0) {
    if (plannedRoute.intent === 'charging' && plannedRoute.targetNodeId) {
      const targetNode = nodes.find(node => node.id === plannedRoute.targetNodeId);
      await updateDronePosition(drone.id, lat, lng, newBattery, 'charging', {
        waypoints: [],
        intent: null,
      });
      if (targetNode) {
        await updateNodeLoad(targetNode.id, targetNode.current_load + 1);
      }
    } else {
      await updateDronePosition(drone.id, lat, lng, newBattery, 'idle', {
        waypoints: [],
        intent: null,
      });
    }
    routeCache.delete(drone.id);
    return;
  }

  await updateDronePosition(drone.id, lat, lng, newBattery, movingStatus, {
    waypoints: plannedRoute.waypoints,
    intent: plannedRoute.intent,
  });
  routeCache.set(drone.id, plannedRoute);
};

// Simulate drone behavior
export const simulateDrone = async (
  drone: Drone,
  nodes: Node[],
  drones: Drone[]
): Promise<void> => {
  try {
    // If battery is critically low and not charging, plan a charging route
    if (drone.battery < 25 && drone.status !== 'charging') {
      const chargingRoute = await resolveChargingRoute(drone, nodes, drones);
      if (chargingRoute) {
        await advanceAlongRoute(drone, chargingRoute, nodes, 'en_route');
        return;
      }
    }

    // If charging, increase battery
    if (drone.status === 'charging') {
      const newBattery = Math.min(100, drone.battery + 2); // Charge 2% per update
      
      if (newBattery >= 95) {
        // Fully charged, leave node
        if (drone.current_node_id) {
          const currentNode = nodes.find(n => n.id === drone.current_node_id);
          if (currentNode) {
            await updateNodeLoad(currentNode.id, Math.max(0, currentNode.current_load - 1));
          }
        }
        
        // Create transaction for charging
        if (drone.company_id && drone.current_node_id) {
          const chargingAmount = (95 - drone.battery) * 0.001; // 0.001 SOL per % charged
          await createTransaction(
            drone.id,
            drone.current_node_id,
            drone.company_id,
            chargingAmount
          );
        }
        
        await updateDronePosition(drone.id, drone.lat, drone.lng, newBattery, 'idle', {
          waypoints: [],
          intent: null,
        });
      } else {
        await updateDronePosition(drone.id, drone.lat, drone.lng, newBattery, 'charging', {
          waypoints: [],
          intent: null,
        });
      }
      return;
    }

    // If idle, possibly start a mission route
    if (drone.status === 'idle' && Math.random() > 0.7) {
      // 30% chance to start flying
      const missionRoute = await resolveMissionRoute(drone, nodes, drones);
      await advanceAlongRoute(drone, missionRoute, nodes, 'flying');
      return;
    }

    if (drone.status === 'en_route') {
      const chargingRoute = await resolveChargingRoute(drone, nodes, drones);
      if (chargingRoute) {
        await advanceAlongRoute(drone, chargingRoute, nodes, 'en_route');
        return;
      }
    }

    // If flying, follow the planned route
    if (drone.status === 'flying') {
      const missionRoute = await resolveMissionRoute(drone, nodes, drones);
      await advanceAlongRoute(drone, missionRoute, nodes, 'flying');
      return;
    }
  } catch (error) {
    console.error(`Error simulating drone ${drone.id}:`, error);
  }
};

// Run simulation for all drones
export const runSimulation = async (drones: Drone[], nodes: Node[]): Promise<void> => {
  const promises = drones.map(drone => simulateDrone(drone, nodes, drones));
  await Promise.allSettled(promises);
};
