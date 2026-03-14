// Drone simulation engine
import type { Drone, Node } from '@/types/database';
import { updateDronePosition, createTransaction, updateNodeLoad } from '@/db/api';

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

// Simulate drone behavior
export const simulateDrone = async (
  drone: Drone,
  nodes: Node[]
): Promise<void> => {
  try {
    // If battery is critically low and not charging, find nearest node
    if (drone.battery < 25 && drone.status !== 'charging') {
      const nearestNode = findNearestNode(drone.lat, drone.lng, nodes);
      if (nearestNode) {
        // Set destination to nearest charging node
        const { lat, lng, arrived } = moveDrone(
          drone,
          nearestNode.lat,
          nearestNode.lng
        );

        const distanceTraveled = calculateDistance(drone.lat, drone.lng, lat, lng);
        const batteryDrain = calculateBatteryDrain(distanceTraveled);
        const newBattery = Math.max(0, drone.battery - batteryDrain);

        if (arrived) {
          // Arrived at charging node
          await updateDronePosition(drone.id, lat, lng, newBattery, 'charging');
          await updateNodeLoad(nearestNode.id, nearestNode.current_load + 1);
        } else {
          // En route to charging node
          await updateDronePosition(drone.id, lat, lng, newBattery, 'en_route');
        }
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
        
        await updateDronePosition(drone.id, drone.lat, drone.lng, newBattery, 'idle');
      } else {
        await updateDronePosition(drone.id, drone.lat, drone.lng, newBattery, 'charging');
      }
      return;
    }

    // If idle, assign random destination
    if (drone.status === 'idle' && Math.random() > 0.7) {
      // 30% chance to start flying
      const randomLat = drone.lat + (Math.random() - 0.5) * 0.1;
      const randomLng = drone.lng + (Math.random() - 0.5) * 0.1;
      await updateDronePosition(drone.id, drone.lat, drone.lng, drone.battery, 'flying');
      return;
    }

    // If flying, move randomly
    if (drone.status === 'flying') {
      const randomLat = drone.lat + (Math.random() - 0.5) * 0.002;
      const randomLng = drone.lng + (Math.random() - 0.5) * 0.002;
      
      const distanceTraveled = calculateDistance(drone.lat, drone.lng, randomLat, randomLng);
      const batteryDrain = calculateBatteryDrain(distanceTraveled);
      const newBattery = Math.max(0, drone.battery - batteryDrain);

      await updateDronePosition(drone.id, randomLat, randomLng, newBattery, 'flying');
      return;
    }
  } catch (error) {
    console.error(`Error simulating drone ${drone.id}:`, error);
  }
};

// Run simulation for all drones
export const runSimulation = async (drones: Drone[], nodes: Node[]): Promise<void> => {
  const promises = drones.map(drone => simulateDrone(drone, nodes));
  await Promise.allSettled(promises);
};
