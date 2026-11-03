
require('dotenv').config();

require('express-async-errors'); // lets async route handlers throw into the error middleware
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cfg = require('./config');
const db = require('./db');
const { seed } = require('./seed');

async function main() {
  await db.connect();
  if (cfg.SEED_ON_START) await seed();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, ai: !!cfg.ANTHROPIC_API_KEY })
  );

  app.use('/api/auth', require('./routes/auth').router);
  app.use('/api', require('./routes/profile').router);
  app.use('/api', require('./routes/resume').router);
  app.use('/api', require('./routes/insights').router);
  app.use('/api/recruiter', require('./routes/recruiter').router);
  app.use('/api', (req, res) =>
    res.status(404).json({ error: 'Not found' })
  );

  app.use('/samples', express.static(path.join(cfg.DATA_DIR, 'sample_resumes')));
  app.use('/data', express.static(cfg.DATA_DIR, { index: false }));

  if (fs.existsSync(path.join(cfg.PUBLIC_DIR, 'index.html'))) {
    app.use(express.static(cfg.PUBLIC_DIR));
    app.get('*', (req, res) =>
      res.sendFile(path.join(cfg.PUBLIC_DIR, 'index.html'))
    );
  } else {
    app.get('/', (req, res) =>
      res.send('SkillGraph API is running. The UI files are missing from the public/ folder.')
    );
  }

  // Error handling middleware
  app.use((err, req, res, next) => {
    if (err.status !== 404 && !err.status) {
      console.error(err);
    }

    res.status(err.status || 500).json({
      error: err.message || 'Server error'
    });
  });

  const server = app.listen(cfg.PORT, () => {
    console.log(`\n  SkillGraph is running -> http://localhost:${cfg.PORT}\n`);
    console.log('  Demo candidate : demo@skillgraph.dev / demo1234');
    console.log('  Demo recruiter : recruiter@skillgraph.dev / demo1234\n');
  });

  const stop = async () => {
    server.close();
    await db.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
