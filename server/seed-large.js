import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getDb, closeDb } from './db.js';

const BASE_DATE = '2026-03-15T00:00:00.000Z';

const companiesSeed = [
  'AeroLink',
  'Nimbus Aero',
  'SkyForge',
  'HelioCargo',
  'Polaris Freight',
  'Zephyr Dynamics',
  'CloudTrail Logistics',
  'NovaWing',
  'Altitude Labs',
  'UrbanLift',
  'HorizonX',
  'VectorAir',
  'BlueKite',
  'Redline Aero',
  'Cedar Droneworks',
];

const cities = [
  { key: 'sf', name: 'San Francisco', lat: 37.7749, lng: -122.4194, spread: 0.08 },
  { key: 'nyc', name: 'New York', lat: 40.7128, lng: -74.006, spread: 0.08 },
  { key: 'la', name: 'Los Angeles', lat: 34.0522, lng: -118.2437, spread: 0.09 },
  { key: 'chi', name: 'Chicago', lat: 41.8781, lng: -87.6298, spread: 0.08 },
  { key: 'aus', name: 'Austin', lat: 30.2672, lng: -97.7431, spread: 0.09 },
  { key: 'sea', name: 'Seattle', lat: 47.6062, lng: -122.3321, spread: 0.08 },
];

const slugify = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const stableId = (seedKey) => createHash('sha1').update(seedKey).digest('hex').slice(0, 24);

const seedToNumber = (seedKey) =>
  parseInt(createHash('sha1').update(seedKey).digest('hex').slice(0, 8), 16);

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const jitter = (rng, center, spread) => center + (rng() * 2 - 1) * spread;

const buildCompanies = () =>
  companiesSeed.map((name, index) => {
    const seed_key = `company-${String(index + 1).padStart(2, '0')}`;
    const id = stableId(seed_key);
    return {
      id,
      seed_key,
      name,
      name_lower: name.trim().toLowerCase(),
      wallet_address: `wallet-${stableId(`wallet-${seed_key}`).slice(0, 8)}`,
      created_at: BASE_DATE,
    };
  });

const buildProfiles = (companies) => {
  const profiles = companies.map((company) => {
    const slug = slugify(company.name);
    const username = `operator-${slug}`;
    const seed_key = `profile-${username}`;
    return {
      id: stableId(seed_key),
      seed_key,
      email: `${username}@test.local`,
      username,
      username_lower: username.toLowerCase(),
      role: 'operator',
      company_id: company.id,
      created_at: BASE_DATE,
    };
  });

  profiles.push({
    id: stableId('profile-admin'),
    seed_key: 'profile-admin',
    email: 'admin@test.local',
    username: 'admin',
    username_lower: 'admin',
    role: 'admin',
    company_id: null,
    created_at: BASE_DATE,
  });

  return profiles;
};

const buildNodes = () => {
  const nodes = [];
  for (let i = 1; i <= 50; i += 1) {
    const seed_key = `node-sf-${String(i).padStart(3, '0')}`;
    const rng = mulberry32(seedToNumber(seed_key));
    const city = cities[0];
    nodes.push({
      id: stableId(seed_key),
      seed_key,
      name: `SF-Node-${String(i).padStart(2, '0')}`,
      lat: jitter(rng, city.lat, city.spread),
      lng: jitter(rng, city.lng, city.spread),
      capacity: 6 + Math.floor(rng() * 6),
      current_load: Math.floor(rng() * 3),
      created_at: BASE_DATE,
    });
  }

  const extraCities = cities.slice(1);
  extraCities.forEach((city) => {
    for (let i = 1; i <= 10; i += 1) {
      const seed_key = `node-${city.key}-${String(i).padStart(2, '0')}`;
      const rng = mulberry32(seedToNumber(seed_key));
      nodes.push({
        id: stableId(seed_key),
        seed_key,
        name: `${city.name.split(' ')[0]}-Node-${String(i).padStart(2, '0')}`,
        lat: jitter(rng, city.lat, city.spread),
        lng: jitter(rng, city.lng, city.spread),
        capacity: 5 + Math.floor(rng() * 7),
        current_load: Math.floor(rng() * 3),
        created_at: BASE_DATE,
      });
    }
  });

  return nodes;
};

const buildDrones = (companies) => {
  const drones = [];
  const total = 500;
  for (let i = 0; i < total; i += 1) {
    const company = companies[i % companies.length];
    const city = cities[i % cities.length];
    const seed_key = `drone-${company.seed_key}-${String(i).padStart(3, '0')}`;
    const rng = mulberry32(seedToNumber(seed_key));
    const status = rng() > 0.75 ? 'flying' : 'idle';
    drones.push({
      id: stableId(seed_key),
      seed_key,
      name: `DR-${slugify(company.name).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      company_id: company.id,
      lat: jitter(rng, city.lat, city.spread),
      lng: jitter(rng, city.lng, city.spread),
      battery: Math.round(30 + rng() * 70),
      status,
      destination_lat: null,
      destination_lng: null,
      current_node_id: null,
      created_at: BASE_DATE,
      updated_at: BASE_DATE,
    });
  }
  return drones;
};

const writeCredentialsFile = (companies) => {
  const credentials = [
    {
      role: 'admin',
      username: 'admin',
      password: 'test123',
      company_name: null,
      company_id: null,
    },
    ...companies.map((company) => {
      const username = `operator-${slugify(company.name)}`;
      return {
        role: 'operator',
        username,
        password: 'test123',
        company_name: company.name,
        company_id: company.id,
      };
    }),
  ];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const targetDir = path.join(__dirname, 'seed-data');
  const targetFile = path.join(targetDir, 'company-credentials.json');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetFile, JSON.stringify(credentials, null, 2));
  return targetFile;
};

const upsertMany = async (collection, docs) => {
  for (const doc of docs) {
    await collection.updateOne(
      { seed_key: doc.seed_key },
      { $set: doc },
      { upsert: true }
    );
  }
};

const ensureIndexes = async (db) => {
  await Promise.all([
    db.collection('companies').createIndex({ seed_key: 1 }, { unique: true }),
    db.collection('profiles').createIndex({ seed_key: 1 }, { unique: true }),
    db.collection('nodes').createIndex({ seed_key: 1 }, { unique: true }),
    db.collection('drones').createIndex({ seed_key: 1 }, { unique: true }),
  ]);
};

const main = async () => {
  const db = await getDb();
  if (!db) {
    console.error('Missing MONGODB_URI. Seed skipped.');
    process.exitCode = 1;
    return;
  }

  try {
    await ensureIndexes(db);

    const companies = buildCompanies();
    const profiles = buildProfiles(companies);
    const nodes = buildNodes();
    const drones = buildDrones(companies);

    await upsertMany(db.collection('companies'), companies);
    await upsertMany(db.collection('profiles'), profiles);
    await upsertMany(db.collection('nodes'), nodes);
    await upsertMany(db.collection('drones'), drones);

    const credentialsPath = writeCredentialsFile(companies);

    console.log(`Seeded ${companies.length} companies, ${profiles.length} profiles.`);
    console.log(`Seeded ${nodes.length} nodes and ${drones.length} drones.`);
    console.log(`Wrote credentials to ${credentialsPath}`);
  } finally {
    await closeDb();
  }
};

main();
