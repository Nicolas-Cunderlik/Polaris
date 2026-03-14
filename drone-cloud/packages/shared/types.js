// Shared types for the drone cloud platform

export interface Company {
  id: string;
  name: string;
  walletAddress: string;
}

export interface Drone {
  id: string;
  companyId: string;
  location: { lat: number; lng: number };
  battery: number;
  status: 'flying' | 'charging' | 'waiting';
  destination: { lat: number; lng: number };
}

export interface Node {
  id: string;
  location: { lat: number; lng: number };
  capacity: number;
  ownerCompany: string; // Platform owned
}

export interface Transaction {
  id: string;
  droneId: string;
  nodeId: string;
  amountSol: number;
  timestamp: Date;
}