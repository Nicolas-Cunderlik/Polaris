// Database types for Drone Cloud Platform

export type UserRole = 'operator' | 'provider' | 'admin';
export type DroneStatus = 'idle' | 'flying' | 'charging' | 'en_route';

export interface Company {
  id: string;
  name: string;
  wallet_address: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  role: UserRole;
  company_id: string | null;
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  current_load: number;
  owner_company_id?: string | null;
  created_at: string;
}

export interface Drone {
  id: string;
  name: string;
  company_id: string | null;
  lat: number;
  lng: number;
  battery: number;
  status: DroneStatus;
  destination_lat: number | null;
  destination_lng: number | null;
  current_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  drone_id: string | null;
  node_id: string | null;
  company_id: string | null;
  amount_sol: number;
  timestamp: string;
}

export interface DroneWithCompany extends Drone {
  company?: Company;
}

export interface TransactionWithDetails extends Transaction {
  drone?: Drone;
  node?: Node;
  company?: Company;
}

export interface NetworkMetrics {
  total_nodes: number;
  total_drones: number;
  deliveries_per_hour: number;
  average_delay: number;
  congestion_level: number;
  battery_failures: number;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
}
