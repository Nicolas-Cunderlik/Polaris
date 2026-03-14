import { MongoClient } from 'mongodb';

let client;
let db;

export const getDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (db) {
    return db;
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'polaris');
  return db;
};

export const closeDb = async () => {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
};
