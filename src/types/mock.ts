export interface MockLatLng {
  lat: number;
  lng: number;
}

export interface MockPackage {
  id: string;
  pickup: MockLatLng;
  dropoff: MockLatLng;
  assigned_drone_id: string | null;
}

export interface MockNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  current_load: number;
  created_at: string;
}

export interface MockDrone {
  id: string;
  name: string;
  company_id: string | null;
  lat: number;
  lng: number;
  battery: number;
  status: 'idle' | 'flying' | 'charging' | 'en_route';
  destination_lat: number | null;
  destination_lng: number | null;
  current_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockWaypoint extends MockLatLng {
  eta: number;
  status: string;
}

export interface MockFlightPlan {
  drone_id: string;
  waypoints: MockWaypoint[];
  rerouted: boolean;
}

export type MockRiskZone =
  | {
      id: string;
      type: 'circle';
      center: MockLatLng;
      radius_m: number;
    }
  | {
      id: string;
      type: 'polygon';
      points: MockLatLng[];
    };

export interface MockCongestionBucket {
  timestamp: string;
  node_loads: Array<{ node_id: string; congestion: number }>;
}

export interface MockScenario {
  meta: {
    seed: number;
    center: MockLatLng;
    generated_at: string;
  };
  nodes: MockNode[];
  drones: MockDrone[];
  packages: MockPackage[];
  flight_plans: MockFlightPlan[];
  risk_zones: MockRiskZone[];
  congestion_forecast: MockCongestionBucket[];
}
