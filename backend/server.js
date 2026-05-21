require('dotenv').config();
const app = require('./src/app');
const { scheduleWeeklySync } = require('./src/services/syncService');

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Sanctions Screening API running on port ${PORT}`);
  scheduleWeeklySync();
});
