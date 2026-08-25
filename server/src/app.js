const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDb, getTestDb, resetDb } = require('./database');
const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const clientRoutes = require('./routes/clients');
const settingsRoutes = require('./routes/settings');
const usersRoutes = require('./routes/users');
const logsRoutes = require('./routes/logs');

function createApp(useMemoryDb = false) {
  const app = express();

  // Initialize database
  if (useMemoryDb) {
    resetDb();
    getTestDb();
  }
  initDb();

  // Middleware
  app.use(express.json());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
  }));

  // Session configuration
  if (useMemoryDb) {
    // In-memory session store for tests
    app.use(session({
      secret: process.env.SESSION_SECRET || 'test-secret-for-unit-tests',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      }
    }));
  } else {
    // SQLite-backed session store for production
    app.use(session({
      store: new SQLiteStore({
        db: 'sessions.db',
        dir: path.join(__dirname, '..', 'data'),
        table: 'sessions'
      }),
      secret: process.env.SESSION_SECRET || 'test-secret-for-unit-tests',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      }
    }));
  }

  // Rate limiting for login ONLY (disabled in test mode)
  if (!useMemoryDb) {
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: 'Too many login attempts, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip
    });
    app.use('/api/auth/login', loginLimiter);
  }

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/logs', logsRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

module.exports = { createApp };
