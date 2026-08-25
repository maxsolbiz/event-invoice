const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../database');

const router = express.Router();

// Dummy hash for timing normalization when user not found
const DUMMY_HASH = '$2b$12$' + 'x'.repeat(53);

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    // Always run bcrypt compare to normalize timing
    const hashToCheck = user ? user.password_hash : DUMMY_HASH;
    const passwordValid = bcrypt.compareSync(password, hashToCheck);

    if (!user || !passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_active === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.loginTimestamp = new Date().toISOString();

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } finally {
    // No db.close() — using shared connection
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const db = getDb();
  try {
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } finally {
    // No db.close() — using shared connection
  }
});

module.exports = router;
