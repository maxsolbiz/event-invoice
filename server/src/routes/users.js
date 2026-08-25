const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../database');
const { requireRole } = require('../middleware');
const { logActivity } = require('../lib/activity');

const router = express.Router();

// All routes require admin role
router.use(requireRole('admin'));

// GET /api/users — list all users
router.get('/', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, is_active, created_at FROM users').all();
  res.json({ users });
});

// POST /api/users — create a new user
router.post('/', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' });
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, passwordHash, role);

  logActivity(db, req, 'user.create', 'user', result.lastInsertRowid,
    `Created user ${username} with role ${role}`);

  res.json({ id: result.lastInsertRowid, message: 'User created' });
});

// PUT /api/users/:id — update role and/or is_active
router.put('/:id', (req, res) => {
  const { role, is_active } = req.body;
  const id = Number(req.params.id);

  const db = getDb();

  const user = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Last-admin protection — synchronous, no async boundary between check and update
  if (is_active === 0 && user.is_active === 1 && user.role === 'admin') {
    const activeAdminCount = db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE role = ? AND is_active = 1'
    ).get('admin').c;
    if (activeAdminCount < 2) {
      return res.status(409).json({ error: 'Cannot deactivate the last active admin' });
    }
  }

  if (role && role !== 'admin' && user.role === 'admin') {
    const activeAdminCount = db.prepare(
      'SELECT COUNT(*) as c FROM users WHERE role = ? AND is_active = 1'
    ).get('admin').c;
    if (activeAdminCount < 2) {
      return res.status(409).json({ error: 'Cannot demote the last active admin' });
    }
  }

  // Partial update — COALESCE keeps existing value if field not provided
  db.prepare(
    'UPDATE users SET role = COALESCE(?, role), is_active = COALESCE(?, is_active) WHERE id = ?'
  ).run(role ?? null, is_active ?? null, id);

  // Activity log — only if something actually changed (no-op guard)
  if (role !== undefined || is_active !== undefined) {
    const target = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    const fragments = [];
    if (role !== undefined) fragments.push(`role to ${role}`);
    if (is_active !== undefined) fragments.push(is_active ? 'activated' : 'deactivated');
    logActivity(db, req, 'user.update', 'user', id,
      `Updated user ${target?.username || ''}: ${fragments.join(', ')}`);
  }

  res.json({ message: 'User updated' });
});

// PUT /api/users/:id/password — admin password reset
router.put('/:id/password', (req, res) => {
  const { password } = req.body;
  const id = Number(req.params.id);

  const db = getDb();

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?')
    .run(passwordHash, now, id);

  const target = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
  logActivity(db, req, 'user.password_reset', 'user', id,
    `Reset password for user ${target?.username || ''}`);

  res.json({ message: 'Password updated' });
});

module.exports = router;
