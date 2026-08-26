const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../database');
const { extractIP } = require('../lib/activity');
const { getGeoLocation } = require('../lib/geo');

const router = express.Router();

// Dummy hash for timing normalization when user not found
const DUMMY_HASH = '$2b$12$' + 'x'.repeat(53);

function logLoginEvent(db, userId, username, success, failureReason, ip, userAgent, req) {
  let rowId = null;
  try {
    const result = db.prepare(
      `INSERT INTO login_events
       (user_id, username_attempted, success, failure_reason, ip_address, user_agent,
        location_city, location_region, location_country, location_coords)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`
    ).run(userId, username, success ? 1 : 0, failureReason, ip, userAgent);
    rowId = result.lastInsertRowid;
  } catch (e) { /* logging failure must not break auth */ return; }

  // Fire-and-forget: enrich with geo data
  getGeoLocation(ip).then((geo) => {
    if (!geo || !rowId) return;
    try {
      db.prepare(
        `UPDATE login_events
         SET location_city = ?, location_region = ?, location_country = ?, location_coords = ?
         WHERE id = ?`
      ).run(geo.city, geo.region, geo.country, geo.coords, rowId);
    } catch (e) { /* ignore */ }
  }).catch(() => {});
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDb();
  const ip = extractIP(req);
  const userAgent = req.headers['user-agent'] || null;

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    // Always run bcrypt compare to normalize timing
    const hashToCheck = user ? user.password_hash : DUMMY_HASH;
    const passwordValid = bcrypt.compareSync(password, hashToCheck);

    if (!user || !passwordValid) {
      logLoginEvent(db, user ? user.id : null, username.slice(0, 100), false,
        user ? 'wrong_password' : 'nonexistent', ip, userAgent, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.is_active === 0) {
      logLoginEvent(db, user.id, username.slice(0, 100), false, 'deactivated', ip, userAgent, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.loginTimestamp = new Date().toISOString();

      logLoginEvent(db, user.id, username.slice(0, 100), true, null, ip, userAgent, req);

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json({
          message: 'Login successful',
          user: { id: user.id, username: user.username, role: user.role },
          must_change_password: !user.password_changed_at
        });
      });
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
    const user = db.prepare('SELECT id, username, role, password_changed_at, created_at FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: { id: user.id, username: user.username, role: user.role, created_at: user.created_at },
      must_change_password: !user.password_changed_at
    });
  } finally {
    // No db.close() — using shared connection
  }
});

module.exports = router;
