const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const auditRoutes = require('./routes/audit');
const reportRoutes = require('./routes/report');
const syncRoutes = require('./routes/sync');
const usersRoutes = require('./routes/users');

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://sanctions-frontend-production.up.railway.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', usersRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
