import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import { seedData } from './seed.js';

const memoryStore = {
  companies: [...seedData.companies],
  profiles: [...seedData.profiles],
  nodes: [...seedData.nodes],
  drones: [...seedData.drones],
  transactions: [...seedData.transactions],
};

const withCollection = async (name, handler) => {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection(name);
  return handler(collection);
};

const sanitizeDoc = (doc) => {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
};

export const getCompanies = async () => {
  const result = await withCollection('companies', (collection) =>
    collection.find({}, { projection: { _id: 0 } }).toArray()
  );
  return result ?? memoryStore.companies;
};

export const getCompanyById = async (id) => {
  const result = await withCollection('companies', (collection) =>
    collection.findOne({ id }, { projection: { _id: 0 } })
  );
  if (result) return result;
  return memoryStore.companies.find((company) => company.id === id) ?? null;
};

export const getProfiles = async () => {
  const result = await withCollection('profiles', (collection) =>
    collection.find({}, { projection: { _id: 0 } }).toArray()
  );
  return result ?? memoryStore.profiles;
};

export const getProfileById = async (id) => {
  const result = await withCollection('profiles', (collection) =>
    collection.findOne({ id }, { projection: { _id: 0 } })
  );
  if (result) return result;
  return memoryStore.profiles.find((profile) => profile.id === id) ?? null;
};

export const upsertProfile = async (profile) => {
  const result = await withCollection('profiles', async (collection) => {
    await collection.updateOne({ id: profile.id }, { $set: profile }, { upsert: true });
    return profile;
  });
  if (result) return result;

  const index = memoryStore.profiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) {
    memoryStore.profiles[index] = { ...memoryStore.profiles[index], ...profile };
  } else {
    memoryStore.profiles.push(profile);
  }
  return profile;
};

export const updateProfile = async (id, updates) => {
  const result = await withCollection('profiles', (collection) =>
    collection.updateOne({ id }, { $set: updates })
  );
  if (result) return;

  const index = memoryStore.profiles.findIndex((profile) => profile.id === id);
  if (index >= 0) {
    memoryStore.profiles[index] = { ...memoryStore.profiles[index], ...updates };
  }
};

export const getNodes = async () => {
  const nodes =
    (await withCollection('nodes', (collection) =>
      collection.find({}, { projection: { _id: 0 } }).toArray()
    )) ?? memoryStore.nodes;
  return nodes;
};

export const getNodeById = async (id) => {
  const result = await withCollection('nodes', (collection) =>
    collection.findOne({ id }, { projection: { _id: 0 } })
  );
  if (result) return sanitizeDoc(result);
  return memoryStore.nodes.find((node) => node.id === id) ?? null;
};

export const createNode = async (node) => {
  const newNode = {
    ...node,
    id: randomUUID(),
    current_load: 0,
    created_at: new Date().toISOString(),
  };

  const result = await withCollection('nodes', (collection) =>
    collection.insertOne(newNode)
  );
  if (result) return newNode;

  memoryStore.nodes.push(newNode);
  return newNode;
};

export const updateNode = async (id, updates) => {
  const result = await withCollection('nodes', (collection) =>
    collection.updateOne({ id }, { $set: updates })
  );
  if (result) return;

  const index = memoryStore.nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    memoryStore.nodes[index] = { ...memoryStore.nodes[index], ...updates };
  }
};

export const getDrones = async () => {
  const drones =
    (await withCollection('drones', (collection) =>
      collection.find({}, { projection: { _id: 0 } }).toArray()
    )) ?? memoryStore.drones;
  const companies = await getCompanies();
  return drones.map((drone) => ({
    ...drone,
    company: drone.company_id
      ? companies.find((company) => company.id === drone.company_id) ?? null
      : null,
  }));
};

export const getDroneById = async (id) => {
  const result = await withCollection('drones', (collection) =>
    collection.findOne({ id }, { projection: { _id: 0 } })
  );
  if (result) return sanitizeDoc(result);
  return memoryStore.drones.find((drone) => drone.id === id) ?? null;
};

export const updateDrone = async (id, updates) => {
  const result = await withCollection('drones', (collection) =>
    collection.updateOne({ id }, { $set: updates })
  );
  if (result) return;

  const index = memoryStore.drones.findIndex((drone) => drone.id === id);
  if (index >= 0) {
    memoryStore.drones[index] = { ...memoryStore.drones[index], ...updates };
  }
};

export const createDrone = async (payload) => {
  const now = new Date().toISOString();
  const newDrone = {
    id: randomUUID(),
    name: payload.name,
    company_id: payload.company_id ?? null,
    lat: payload.lat ?? 37.7749 + (Math.random() - 0.5) * 0.05,
    lng: payload.lng ?? -122.4194 + (Math.random() - 0.5) * 0.05,
    battery: payload.battery ?? 100,
    status: payload.status ?? 'idle',
    destination_lat: null,
    destination_lng: null,
    current_node_id: null,
    created_at: now,
    updated_at: now,
  };

  const result = await withCollection('drones', (collection) =>
    collection.insertOne(newDrone)
  );
  if (result) return newDrone;

  memoryStore.drones.push(newDrone);
  return newDrone;
};

export const deleteDrone = async (id) => {
  const result = await withCollection('drones', (collection) =>
    collection.deleteOne({ id })
  );
  if (result) return true;

  const index = memoryStore.drones.findIndex((drone) => drone.id === id);
  if (index >= 0) {
    memoryStore.drones.splice(index, 1);
    return true;
  }
  return false;
};

export const getTransactions = async (limit = 50) => {
  const transactions =
    (await withCollection('transactions', (collection) =>
      collection
        .find({}, { projection: { _id: 0 } })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    )) ??
    [...memoryStore.transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

  const [drones, nodes, companies] = await Promise.all([
    getDrones(),
    getNodes(),
    getCompanies(),
  ]);

  return transactions.map((tx) => ({
    ...tx,
    drone: drones.find((drone) => drone.id === tx.drone_id) ?? null,
    node: nodes.find((node) => node.id === tx.node_id) ?? null,
    company: companies.find((company) => company.id === tx.company_id) ?? null,
  }));
};

export const createTransaction = async (transaction) => {
  const newTx = {
    ...transaction,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const result = await withCollection('transactions', (collection) =>
    collection.insertOne(newTx)
  );
  if (result) return newTx;

  memoryStore.transactions.push(newTx);
  return newTx;
};

export const getNetworkMetrics = async () => {
  const [nodes, drones, transactions] = await Promise.all([
    getNodes(),
    getDrones(),
    getTransactions(500),
  ]);

  const totalNodes = nodes.length;
  const totalDrones = drones.length;
  const totalTransactions = transactions.length;

  const deliveriesPerHour = Math.round(totalTransactions / 24);

  const congestionLevel =
    nodes.length > 0
      ? Math.round(
          (nodes.reduce((sum, node) => sum + node.current_load / node.capacity, 0) / nodes.length) *
            100
        )
      : 0;

  const batteryFailures = drones.filter((drone) => drone.battery < 20).length;

  return {
    total_nodes: totalNodes,
    total_drones: totalDrones,
    deliveries_per_hour: deliveriesPerHour,
    average_delay: Math.random() * 5 + 2,
    congestion_level: congestionLevel,
    battery_failures: batteryFailures,
  };
};
