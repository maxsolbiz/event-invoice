const express = require('express');
const { getDb } = require('../database');
const { requireRole } = require('../middleware');

const router = express.Router();

router.use(requireRole('admin'));

function paginate(query, params, page, limit) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const countQuery = query.replace(/SELECT .+? FROM/, 'SELECT COUNT(*) as count FROM');
  const { count } = db.prepare(countQuery).get(...params);
  const totalPages = Math.ceil(count / limit);

  const rows = db.prepare(query + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(...params, limit, offset);

  return { rows, pagination: { page, limit, total: count, totalPages } };
}

function normalizeDate(dateStr, appendTime) {
  if (!dateStr) return null;
  if (dateStr.length === 10 && appendTime) {
    return dateStr + ' 23:59:59';
  }
  return dateStr;
}

router.get('/login-events', (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);

  let where = [];
  let params = [];

  const from = normalizeDate(req.query.from, false);
  const to = normalizeDate(req.query.to, true);
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }

  if (req.query.success !== undefined) {
    where.push('success = ?');
    params.push(parseInt(req.query.success));
  }
  if (req.query.failure_reason) {
    where.push('failure_reason = ?');
    params.push(req.query.failure_reason);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const query = 'SELECT id, username_attempted, success, failure_reason, ip_address, user_agent, created_at FROM login_events' + whereClause;

  const result = paginate(query, params, page, limit);
  res.json(result);
});

router.get('/activity', (req, res) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);

  let where = [];
  let params = [];

  const from = normalizeDate(req.query.from, false);
  const to = normalizeDate(req.query.to, true);
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to); }

  if (req.query.action) {
    where.push('action = ?');
    params.push(req.query.action);
  }
  if (req.query.entity_type) {
    where.push('entity_type = ?');
    params.push(req.query.entity_type);
  }

  const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const query = 'SELECT id, username_snapshot, action, entity_type, entity_id, description, created_at FROM activity_log' + whereClause;

  const result = paginate(query, params, page, limit);
  res.json(result);
});

module.exports = router;
