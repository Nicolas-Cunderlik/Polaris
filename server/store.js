import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from './db.js';
import { seedData } from './seed.js';

const memoryStore = {
  users: [...seedData.users],
  companies: [...seedData.companies],
  profiles: [...seedData.profiles],
  nodes: [...seedData.nodes],
  drones: [...seedData.drones],
  transactions: [...seedData.transactions],
};

const normalizeCompanyName = (name) => name.trim().toLowerCase();

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

const normalizeUsername = (username) => username.trim().toLowerCase();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createPasswordHash = (password) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
};

const verifyPassword = (password, passwordHash) => {
  const [salt, key] = passwordHash.split(':');
  if (!salt || !key) {
    return false;
  }

  const expectedKey = Buffer.from(key, 'hex');
  const derivedKey = scryptSync(password, salt, expectedKey.length);
  return timingSafeEqual(expectedKey, derivedKey);
};

const toProfile = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role,
  company_id: user.company_id,
  created_at: user.created_at,
});

const toAuthUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  created_at: user.created_at,
});

const createProfileDefaults = async (username) => {
  const normalized = normalizeUsername(username);
  const role =
    normalized === 'admin' ? 'admin' : normalized === 'provider' ? 'provider' : 'operator';

  const companyIdLookup = {
    provider: 'company-aurora',
    operator: 'company-skylink',
    aurora: 'company-aurora',
    skylink: 'company-skylink',
    nimbus: 'company-nimbus',
  };

  if (role === 'admin') {
    return { role, company_id: null };
  }

  const existingProfiles = await getProfiles();
  const isFirstProfile = existingProfiles.length === 0;
  return {
    role: isFirstProfile ? 'admin' : role,
    company_id: isFirstProfile ? null : companyIdLookup[normalized] ?? 'company-aurora',
  };
};

const findMemoryUserByUsername = (username) => {
  const normalized = normalizeUsername(username);
  return memoryStore.users.find((user) => user.username_lower === normalized) ?? null;
};

const withUsersCollection = async (handler) => {
  const db = await getDb();
  if (!db) return null;
  return handler(db.collection('users'));
};

const getUserByUsername = async (username) => {
  const normalized = normalizeUsername(username);
  const result = await withUsersCollection((collection) =>
    collection.findOne({ username_lower: normalized }, { projection: { _id: 0 } })
  );

  if (result) {
    return sanitizeDoc(result);
  }

  return findMemoryUserByUsername(username);
};

const profileUsernameExists = async (username) => {
  const normalized = normalizeUsername(username);
  const result = await withCollection('profiles', (collection) =>
    collection.findOne(
      { username: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' } },
      { projection: { _id: 0, id: 1 } }
    )
  );

  if (result) {
    return true;
  }

  return memoryStore.profiles.some((profile) => normalizeUsername(profile.username ?? '') === normalized);
};

export const signUpUser = async ({ username, password }) => {
  const trimmedUsername = username.trim();
  const normalized = normalizeUsername(trimmedUsername);
  if (!trimmedUsername || !password) {
    throw new Error('Username and password are required');
  }

  const existingUser = await getUserByUsername(trimmedUsername);
  if (existingUser) {
    throw new Error('Username already exists');
  }

  if (await profileUsernameExists(trimmedUsername)) {
    throw new Error('Username already exists');
  }

  const created_at = new Date().toISOString();
  const { role, company_id } = await createProfileDefaults(trimmedUsername);
  const user = {
    id: randomUUID(),
    username: trimmedUsername,
    username_lower: normalized,
    email: `${normalized}@miaoda.com`,
    role,
    company_id,
    created_at,
    password_hash: createPasswordHash(password),
  };

  let result;
  try {
    result = await withUsersCollection(async (collection) => {
      await collection.createIndex({ username_lower: 1 }, { unique: true });
      await collection.insertOne(user);
      return user;
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error('Username already exists');
    }
    throw error;
  }

  if (!result) {
    memoryStore.users.push(user);
  }

  const profile = toProfile(user);
  await upsertProfile(profile);

  return {
    user: toAuthUser(user),
    profile,
  };
};

export const loginUser = async ({ username, password }) => {
  const trimmedUsername = username.trim();
  if (!trimmedUsername || !password) {
    throw new Error('Username and password are required');
  }

  const user = await getUserByUsername(trimmedUsername);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error('Invalid username or password');
  }

  return {
    user: toAuthUser(user),
    profile: toProfile(user),
  };
};

export const getCompanies = async () => {
  const result = await withCollection('companies', (collection) =>
    collection.find({}, { projection: { _id: 0 } }).toArray()
  );
  return result ?? memoryStore.companies;
};

export const createCompany = async (name) => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Company name is required.');
  }

  const normalized = normalizeCompanyName(trimmed);
  const existingFromDb = await withCollection('companies', async (collection) => {
    const byLower = await collection.findOne(
      { name_lower: normalized },
      { projection: { _id: 0 } }
    );
    if (byLower) return byLower;
    return collection.findOne(
      { name: trimmed },
      { projection: { _id: 0 }, collation: { locale: 'en', strength: 2 } }
    );
  });

  const existing =
    existingFromDb ??
    memoryStore.companies.find(
      (company) => normalizeCompanyName(company.name) === normalized
    );

  if (existing) {
    throw new Error('A company with this name already exists.');
  }

  const newCompany = {
    id: randomUUID(),
    name: trimmed,
    name_lower: normalized,
    wallet_address: `wallet-${Math.random().toString(36).slice(2, 10)}`,
    created_at: new Date().toISOString(),
  };

  const result = await withCollection('companies', (collection) =>
    collection.insertOne(newCompany)
  );
  if (result) return newCompany;

  memoryStore.companies.push(newCompany);
  return newCompany;
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

export const getProfileByUsername = async (username) => {
  const normalized = username?.trim().toLowerCase();
  if (!normalized) return null;

  const result = await withCollection('profiles', async (collection) => {
    const byLower = await collection.findOne(
      { username_lower: normalized },
      { projection: { _id: 0 } }
    );
    if (byLower) return byLower;
    return collection.findOne(
      { username: username?.trim() },
      { projection: { _id: 0 }, collation: { locale: 'en', strength: 2 } }
    );
  });
  if (result) return result;
  return (
    memoryStore.profiles.find(
      (profile) => profile.username?.trim().toLowerCase() === normalized
    ) ?? null
  );
};

export const upsertProfile = async (profile) => {
  const usernameLower = profile.username?.trim().toLowerCase();
  const enrichedProfile = usernameLower
    ? { ...profile, username_lower: usernameLower }
    : profile;
  const result = await withCollection('profiles', async (collection) => {
    await collection.updateOne(
      { id: profile.id },
      { $set: enrichedProfile },
      { upsert: true }
    );
    return enrichedProfile;
  });
  if (result) return result;

  const index = memoryStore.profiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) {
    memoryStore.profiles[index] = { ...memoryStore.profiles[index], ...enrichedProfile };
  } else {
    memoryStore.profiles.push(enrichedProfile);
  }
  return enrichedProfile;
};

export const associateProfileCompany = async (profileId, companyId) => {
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error('Profile not found.');
  }

  if (profile.company_id) {
    throw new Error('Company registration is locked once a company is assigned.');
  }

  const company = await getCompanyById(companyId);
  if (!company) {
    throw new Error('Company not found.');
  }

  await updateProfile(profileId, { company_id: companyId });
  return { ...profile, company_id: companyId };
};

export const clearProfileCompany = async (profileId) => {
  const profile = await getProfileById(profileId);
  if (!profile) {
    throw new Error('Profile not found.');
  }

  await updateProfile(profileId, { company_id: null });
  return { ...profile, company_id: null };
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
  if (!payload?.company_id) {
    throw new Error('Company association is required to register a drone.');
  }
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
