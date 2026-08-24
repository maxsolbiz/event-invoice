const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDb, DB_PATH } = require('./database');
const authRoutes = require('./routes/auth');

// Fail fast if SESSION_SECRET is not set
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required. Set it before starting the server.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database tables
initDb();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Session configuration with SQLite-backed store
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '..', 'data'),
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Rate limiting for login ONLY
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// Routes — rate limiter applied ONLY to /login, mounted before auth routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
