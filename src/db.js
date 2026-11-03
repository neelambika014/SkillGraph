const fs = require('fs');
const mongoose = require('mongoose');
const cfg = require('./config');

let memServer = null;

async function tryConnect(uri, ms = 2500) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: ms });
  return uri;
}

async function connect() {
  mongoose.set('strictQuery', true);
  if (cfg.MONGO_URI) {
    await tryConnect(cfg.MONGO_URI, 8000);
    console.log('[db] connected to MONGO_URI');
    return;
  }
  try {
    await tryConnect('mongodb://127.0.0.1:27017/skillgraph');
    console.log('[db] connected to local MongoDB at 127.0.0.1:27017/skillgraph');
    return;
  } catch (_) {
    await mongoose.disconnect().catch(() => {});
  }
  console.log('[db] no MongoDB found - starting embedded MongoDB (first run downloads the binary, please wait)...');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  fs.mkdirSync(cfg.MONGO_DATA_DIR, { recursive: true });
  memServer = await MongoMemoryServer.create({
    instance: { dbPath: cfg.MONGO_DATA_DIR, storageEngine: 'wiredTiger', dbName: 'skillgraph' },
  });
  await tryConnect(memServer.getUri('skillgraph'), 10000);
  console.log(`[db] embedded MongoDB ready (data persisted in ${cfg.MONGO_DATA_DIR})`);
}

async function disconnect() {
  await mongoose.disconnect().catch(() => {});
  if (memServer) await memServer.stop().catch(() => {});
}

module.exports = { connect, disconnect };
