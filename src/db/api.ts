// API layer for Supabase operations
import { supabase } from './supabase';
import type {
  Company,
  Profile,
  Node,
  Drone,
  Transaction,
  DroneWithCompany,
  NodeWithCompany,
  TransactionWithDetails,
  NetworkMetrics,
} from '@/types/database';

// Companies API
export const getCompanies = async (): Promise<Company[]> => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const getCompanyById = async (id: string): Promise<Company | null> => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

// Profiles API
export const getCurrentProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const getAllProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const updateProfile = async (id: string, updates: Partial<Profile>): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
};

// Nodes API
export const getNodes = async (): Promise<NodeWithCompany[]> => {
  const { data, error } = await supabase
    .from('nodes')
    .select(`
      *,
      owner_company:companies!owner_company_id(*)
    `)
    .order('name');
  
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const getNodeById = async (id: string): Promise<Node | null> => {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const createNode = async (node: Omit<Node, 'id' | 'created_at' | 'current_load'>): Promise<Node> => {
  const { data, error } = await supabase
    .from('nodes')
    .insert([node])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateNodeLoad = async (id: string, load: number): Promise<void> => {
  const { error } = await supabase
    .from('nodes')
    .update({ current_load: load })
    .eq('id', id);
  
  if (error) throw error;
};

// Drones API
export const getDrones = async (): Promise<DroneWithCompany[]> => {
  const { data, error } = await supabase
    .from('drones')
    .select(`
      *,
      company:companies!company_id(*)
    `)
    .order('name');
  
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const getDroneById = async (id: string): Promise<Drone | null> => {
  const { data, error } = await supabase
    .from('drones')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

export const updateDrone = async (id: string, updates: Partial<Drone>): Promise<void> => {
  const { error } = await supabase
    .from('drones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
};

export const updateDronePosition = async (
  id: string,
  lat: number,
  lng: number,
  battery: number,
  status: string
): Promise<void> => {
  const { error } = await supabase
    .from('drones')
    .update({
      lat,
      lng,
      battery,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  
  if (error) throw error;
};

// Transactions API
export const getTransactions = async (limit = 50): Promise<TransactionWithDetails[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      drone:drones!drone_id(name),
      node:nodes!node_id(name),
      company:companies!company_id(name)
    `)
    .order('timestamp', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

export const createTransaction = async (
  droneId: string,
  nodeId: string,
  companyId: string,
  amountSol: number
): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .insert([{
      drone_id: droneId,
      node_id: nodeId,
      company_id: companyId,
      amount_sol: amountSol,
    }]);
  
  if (error) throw error;
};

// Analytics API
export const getNetworkMetrics = async (): Promise<NetworkMetrics> => {
  const [nodesResult, dronesResult, transactionsResult] = await Promise.all([
    supabase.from('nodes').select('id', { count: 'exact', head: true }),
    supabase.from('drones').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ]);

  const totalNodes = nodesResult.count || 0;
  const totalDrones = dronesResult.count || 0;
  const totalTransactions = transactionsResult.count || 0;

  // Calculate deliveries per hour (simulated based on transactions)
  const deliveriesPerHour = Math.round(totalTransactions / 24);

  // Get congestion data
  const { data: nodes } = await supabase.from('nodes').select('capacity, current_load');
  const congestionLevel = nodes && nodes.length > 0
    ? Math.round((nodes.reduce((sum, n) => sum + (n.current_load / n.capacity), 0) / nodes.length) * 100)
    : 0;

  // Get battery failures (drones with battery < 20%)
  const { data: lowBatteryDrones } = await supabase
    .from('drones')
    .select('id')
    .lt('battery', 20);
  const batteryFailures = lowBatteryDrones?.length || 0;

  return {
    total_nodes: totalNodes,
    total_drones: totalDrones,
    deliveries_per_hour: deliveriesPerHour,
    average_delay: Math.random() * 5 + 2, // Simulated: 2-7 minutes
    congestion_level: congestionLevel,
    battery_failures: batteryFailures,
  };
};

// Real-time subscriptions
export const subscribeToDrones = (callback: (payload: any) => void) => {
  return supabase
    .channel('drones-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'drones',
      },
      callback
    )
    .subscribe();
};

export const subscribeToTransactions = (callback: (payload: any) => void) => {
  return supabase
    .channel('transactions-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
      },
      callback
    )
    .subscribe();
};

export const subscribeToNodes = (callback: (payload: any) => void) => {
  return supabase
    .channel('nodes-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'nodes',
      },
      callback
    )
    .subscribe();
};
