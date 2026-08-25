const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');
const { getDb } = require('../src/database');

function countLoginEvents() {
  return getDb().prepare('SELECT COUNT(*) as c FROM login_events').get().c;
}

function lastLoginEvent() {
  return getDb().prepare('SELECT * FROM login_events ORDER BY id DESC LIMIT 1').get();
}

function getTestadminId() {
  return getDb().prepare('SELECT id FROM users WHERE username = ?').get('testadmin').id;
}

describe('Login Events', () => {
  before(() => {
    setupTestDb();
    seedTestData();
  });

  after(() => {
    cleanupTestDb();
  });

  it('#1 — successful login is logged', async () => {
    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_id, getTestadminId());
    assert.strictEqual(row.username_attempted, 'testadmin');
    assert.strictEqual(row.success, 1);
    assert.strictEqual(row.failure_reason, null);
    assert.ok(row.ip_address, 'ip_address should not be null');
  });

  it('#2 — failed login (wrong password) is logged', async () => {
    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'wrong' })
      .expect(401);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_id, getTestadminId());
    assert.strictEqual(row.username_attempted, 'testadmin');
    assert.strictEqual(row.success, 0);
    assert.strictEqual(row.failure_reason, 'wrong_password');
  });

  it('#3 — failed login (nonexistent user) is logged', async () => {
    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'whatever' })
      .expect(401);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_id, null);
    assert.strictEqual(row.username_attempted, 'ghost');
    assert.strictEqual(row.success, 0);
    assert.strictEqual(row.failure_reason, 'nonexistent');
  });

  it('#4 — failed login (deactivated user) is logged', async () => {
    const agent = request.agent(getApp());
    await agent
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    await agent
      .post('/api/users')
      .send({ username: 'deactlog', password: 'pass1234', role: 'user' })
      .expect(200);

    const db = getDb();
    const target = db.prepare('SELECT id FROM users WHERE username = ?').get('deactlog');

    await agent
      .put(`/api/users/${target.id}`)
      .send({ is_active: 0 })
      .expect(200);

    // Login as deactivated user
    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'deactlog', password: 'pass1234' })
      .expect(401);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_id, target.id);
    assert.strictEqual(row.username_attempted, 'deactlog');
    assert.strictEqual(row.success, 0);
    assert.strictEqual(row.failure_reason, 'deactivated');

    // Restore for cleanliness
    await agent
      .put(`/api/users/${target.id}`)
      .send({ is_active: 1 })
      .expect(200);
  });

  it('#5 — multiple failed logins produce separate rows', async () => {
    const before = countLoginEvents();

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'bad1' })
      .expect(401);

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'bad2' })
      .expect(401);

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'bad3' })
      .expect(401);

    const after = countLoginEvents();
    assert.strictEqual(after - before, 3);

    const rows = getDb().prepare('SELECT success FROM login_events ORDER BY id DESC LIMIT 3').all();
    assert.ok(rows.every(r => r.success === 0), 'all three rows should be failures');
  });

  it('#6 — successful login after failures is logged', async () => {
    const before = countLoginEvents();

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'bad' })
      .expect(401);

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'bad' })
      .expect(401);

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    const after = countLoginEvents();
    assert.strictEqual(after - before, 3);

    const row = lastLoginEvent();
    assert.strictEqual(row.success, 1);
    assert.strictEqual(row.failure_reason, null);
  });

  it('#7 — missing fields (400) does NOT log', async () => {
    const before = countLoginEvents();

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin' })
      .expect(400);

    const after = countLoginEvents();
    assert.strictEqual(after, before, 'no new login_event row for 400');
  });

  it('#8 — user_agent captured when provided', async () => {
    await request(getApp())
      .post('/api/auth/login')
      .set('User-Agent', 'TestAgent/1.0')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_agent, 'TestAgent/1.0');
  });

  it('#9 — user_agent is NULL when absent', async () => {
    await request(getApp())
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);

    const row = lastLoginEvent();
    assert.strictEqual(row.user_agent, null);
  });

  it('#10 — username_attempted truncated to 100 chars', async () => {
    const longUsername = 'a'.repeat(150);

    await request(getApp())
      .post('/api/auth/login')
      .send({ username: longUsername, password: 'whatever' })
      .expect(401);

    const row = lastLoginEvent();
    assert.strictEqual(row.username_attempted.length, 100);
    assert.strictEqual(row.username_attempted, 'a'.repeat(100));
  });
});
