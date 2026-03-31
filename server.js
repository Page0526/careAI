require('dotenv').config();
const { createApp } = require('./backend/app');
const config = require('./backend/config');

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`
  ========================================
     CareAI Server Running
     Local:  http://localhost:${config.PORT}
     API:    http://localhost:${config.PORT}/api
  ========================================
  `);
});
