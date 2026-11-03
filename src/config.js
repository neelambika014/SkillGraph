require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: +process.env.PORT || 4000,
  JWT_SECRET: process.env.JWT_SECRET || 'skillgraph-dev-secret',
  MONGO_URI: process.env.MONGO_URI || '',
  SEED_ON_START: (process.env.SEED_ON_START || 'true') !== 'false',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  DATA_DIR: path.join(__dirname, '..', 'data'),
  MONGO_DATA_DIR: path.join(__dirname, '..', '.mongo-data'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
};
