const cors = require('cors');
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes');
const { errorHandler } = require('./lib/http');

function createApp() {
  const app = express();
  const rootDir = path.join(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');

  app.disable('x-powered-by');

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(express.static(publicDir));
  app.use('/icons', express.static(path.join(rootDir, 'icons')));
  app.use('/locales', express.static(path.join(publicDir, 'locales')));

  app.use('/api', apiRoutes);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  app.get('/', (req, res) => {
    res.redirect('/login.html');
  });

  app.get('*', (req, res) => {
    const requestedHtml = req.path.endsWith('.html') ? req.path.replace(/^\//, '') : 'login.html';
    res.sendFile(path.join(publicDir, requestedHtml), (error) => {
      if (error) {
        res.sendFile(path.join(publicDir, 'login.html'));
      }
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };