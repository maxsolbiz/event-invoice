const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');
const { getDb } = require('../src/database');

function countLoginEvents() {
  return getDb().prepare('SELECT COUNT(*) as c FROM login_events').get().c;
}

function countActivityLog() {
  return getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;
}

describe('Logs API', () => {
  let admin;
  let user;

  before(async () => {
    setupTestDb();
    seedTestData();

    admin = request.agent(getApp());
    await admin
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    user = request.agent(getApp());
    await user
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'user123' })
      .expect(200);
  });

  after(() => {
    cleanupTestDb();
  });

  it('#1 — unauthenticated GET /api/logs/login-events returns 401', async () => {
    await request(getApp())
      .get('/api/logs/login-events')
      .expect(401);
  });

  it('#2 — unauthenticated GET /api/logs/activity returns 401', async () => {
    await request(getApp())
      .get('/api/logs/activity')
      .expect(401);
  });

  it('#3 — non-admin GET /api/logs/login-events returns 403', async () => {
    await user
      .get('/api/logs/login-events')
      .expect(403);
  });

  it('#4 — non-admin GET /api/logs/activity returns 403', async () => {
    await user
      .get('/api/logs/activity')
      .expect(403);
  });

  it('#5 — admin GET /api/logs/login-events returns paginated rows', async () => {
    const res = await admin
      .get('/api/logs/login-events')
      .expect(200);

    assert.ok(Array.isArray(res.body.rows));
    assert.ok(res.body.pagination);
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 50);
    assert.strictEqual(typeof res.body.pagination.total, 'number');
    assert.strictEqual(typeof res.body.pagination.totalPages, 'number');
  });

  it('#6 — admin GET /api/logs/activity returns paginated rows', async () => {
    const res = await admin
      .get('/api/logs/activity')
      .expect(200);

    assert.ok(Array.isArray(res.body.rows));
    assert.ok(res.body.pagination);
    assert.strictEqual(res.body.pagination.page, 1);
    assert.strictEqual(res.body.pagination.limit, 50);
    assert.strictEqual(typeof res.body.pagination.total, 'number');
    assert.strictEqual(typeof res.body.pagination.totalPages, 'number');
  });

  it('#7 — page beyond available data returns empty rows', async () => {
    const res = await admin
      .get('/api/logs/login-events?page=999')
      .expect(200);

    assert.strictEqual(res.body.rows.length, 0);
    assert.strictEqual(res.body.pagination.page, 999);
    assert.ok(res.body.pagination.totalPages < 999);
  });

  it('#8 — custom limit respected', async () => {
    const res = await admin
      .get('/api/logs/login-events?limit=2')
      .expect(200);

    assert.ok(res.body.rows.length <= 2);
    assert.strictEqual(res.body.pagination.limit, 2);
  });

  it('#9 — max limit (200) clamp enforced', async () => {
    const res = await admin
      .get('/api/logs/login-events?limit=99999')
      .expect(200);

    assert.ok(res.body.rows.length <= 200);
    assert.strictEqual(res.body.pagination.limit, 200);
  });

  it('#10 — sort order: most recent first', async () => {
    const db = getDb();

    for (let i = 0; i < 3; i++) {
      await admin
        .post('/api/invoices')
        .send({
          pi_no: `MOE-PI-SORT-${i}`, invoice_date: '2026-01-01', currency: 'AED',
          client_name: 'Sort Client', vat: 0,
          services: [{ description: 'Service', qty: 1, unit_price: 100 }]
        })
        .expect(201);
    }

    const res = await admin
      .get('/api/logs/activity?limit=3')
      .expect(200);

    assert.strictEqual(res.body.rows.length, 3);
    const ids = res.body.rows.map(r => r.id);
    assert.ok(ids[0] > ids[1], `first id ${ids[0]} should be > second id ${ids[1]}`);
    assert.ok(ids[1] > ids[2], `second id ${ids[1]} should be > third id ${ids[2]}`);
  });

  it('#11 — date-range filter: login_events', async () => {
    const db = getDb();

    db.prepare(`INSERT INTO login_events(username_attempted, success, created_at) VALUES(?,?,?)`)
      .run('filteruser', 1, '2025-06-15 10:00:00');
    db.prepare(`INSERT INTO login_events(username_attempted, success, created_at) VALUES(?,?,?)`)
      .run('filteruser', 1, '2025-06-20 10:00:00');
    db.prepare(`INSERT INTO login_events(username_attempted, success, created_at) VALUES(?,?,?)`)
      .run('filteruser', 1, '2025-06-25 10:00:00');

    const res = await admin
      .get('/api/logs/login-events?from=2025-06-18&to=2025-06-22')
      .expect(200);

    const usernames = res.body.rows.map(r => r.username_attempted);
    assert.ok(usernames.includes('filteruser'));
    assert.ok(!res.body.rows.some(r => r.created_at.startsWith('2025-06-15')));
    assert.ok(!res.body.rows.some(r => r.created_at.startsWith('2025-06-25')));
  });

  it('#12 — date-range filter: activity_log', async () => {
    const db = getDb();

    db.prepare(`INSERT INTO activity_log(username_snapshot, action, entity_type, entity_id, description, created_at) VALUES(?,?,?,?,?,?)`)
      .run('admin', 'invoice.create', 'invoice', 900, 'Test old', '2025-03-01 10:00:00');
    db.prepare(`INSERT INTO activity_log(username_snapshot, action, entity_type, entity_id, description, created_at) VALUES(?,?,?,?,?,?)`)
      .run('admin', 'invoice.create', 'invoice', 901, 'Test mid', '2025-03-15 10:00:00');
    db.prepare(`INSERT INTO activity_log(username_snapshot, action, entity_type, entity_id, description, created_at) VALUES(?,?,?,?,?,?)`)
      .run('admin', 'invoice.create', 'invoice', 902, 'Test new', '2025-03-20 10:00:00');

    const res = await admin
      .get('/api/logs/activity?from=2025-03-10&to=2025-03-18')
      .expect(200);

    const descriptions = res.body.rows.map(r => r.description);
    assert.ok(descriptions.includes('Test mid'));
    assert.ok(!descriptions.includes('Test old'));
    assert.ok(!descriptions.includes('Test new'));
  });

  it('#13 — success filter: login_events', async () => {
    const db = getDb();

    db.prepare(`INSERT INTO login_events(username_attempted, success, failure_reason, created_at) VALUES(?,?,?,?)`)
      .run('failuser', 0, 'wrong_password', '2025-07-01 10:00:00');

    const res = await admin
      .get('/api/logs/login-events?success=0')
      .expect(200);

    assert.ok(res.body.rows.every(r => r.success === 0));
  });

  it('#14 — action filter: activity_log', async () => {
    const db = getDb();

    db.prepare(`INSERT INTO activity_log(username_snapshot, action, entity_type, entity_id, description, created_at) VALUES(?,?,?,?,?,?)`)
      .run('admin', 'client.create', 'client', 800, 'Action test', '2025-08-01 10:00:00');

    const res = await admin
      .get('/api/logs/activity?action=client.create')
      .expect(200);

    assert.ok(res.body.rows.every(r => r.action === 'client.create'));
  });

  it('#15 — entity_type filter: activity_log', async () => {
    const db = getDb();

    db.prepare(`INSERT INTO activity_log(username_snapshot, action, entity_type, entity_id, description, created_at) VALUES(?,?,?,?,?,?)`)
      .run('admin', 'settings.update', 'settings', 1, 'Entity test', '2025-09-01 10:00:00');

    const res = await admin
      .get('/api/logs/activity?entity_type=settings')
      .expect(200);

    assert.ok(res.body.rows.every(r => r.entity_type === 'settings'));
  });

  it('#16 — reading activity_log does NOT create new activity_log rows', async () => {
    const countBefore = countActivityLog();

    await admin
      .get('/api/logs/activity')
      .expect(200);

    const countAfter = countActivityLog();
    assert.strictEqual(countAfter, countBefore);
  });

  it('#17 — empty table returns empty rows (not error)', async () => {
    const res = await admin
      .get('/api/logs/login-events?page=999&limit=50')
      .expect(200);

    assert.ok(Array.isArray(res.body.rows));
    assert.strictEqual(res.body.rows.length, 0);
    assert.ok(typeof res.body.pagination.total === 'number');
    assert.ok(typeof res.body.pagination.totalPages === 'number');
  });
});
