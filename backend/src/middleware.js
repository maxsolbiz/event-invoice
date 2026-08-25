const { getDb } = require('./database');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, is_active, password_changed_at FROM users WHERE id = ?').get(req.session.userId);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (user.password_changed_at && req.session.loginTimestamp &&
      user.password_changed_at >= req.session.loginTimestamp) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, is_active, role, password_changed_at FROM users WHERE id = ?').get(req.session.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.password_changed_at && req.session.loginTimestamp &&
        user.password_changed_at >= req.session.loginTimestamp) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
