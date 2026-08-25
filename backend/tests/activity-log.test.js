const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');
const { getDb } = require('../src/database');

function countActivityLog() {
  return getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;
}

function lastActivityLog() {
  return getDb().prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 1').get();
}

function getTestadminId() {
  return getDb().prepare('SELECT id FROM users WHERE username = ?').get('testadmin').id;
}

describe('Activity Log', () => {
  let admin;

  before(async () => {
    setupTestDb();
    seedTestData();
    admin = request.agent(getApp());
    await admin
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' })
      .expect(200);
  });

  after(() => {
    cleanupTestDb();
  });

  // --- Invoices ---

  it('#1 — invoice create logged', async () => {
    const res = await admin
      .post('/api/invoices')
      .send({
        invoice_date: '2026-01-01', currency: 'AED',
        client_name: 'Activity Client', vat: 0,
        services: [{ description: 'Service A', qty: 1, unit_price: 100 }]
      })
      .expect(201);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'invoice.create');
    assert.strictEqual(row.entity_type, 'invoice');
    assert.strictEqual(row.entity_id, res.body.id);
    assert.ok(row.description.includes('Activity Client'));
    assert.strictEqual(row.username_snapshot, 'testadmin');
  });

  it('#2 — invoice update logged', async () => {
    const db = getDb();
    const invoiceId = db.prepare('SELECT id FROM invoices WHERE client_name = ?').get('Activity Client').id;

    await admin
      .put(`/api/invoices/${invoiceId}`)
      .send({
        invoice_date: '2026-01-01', currency: 'AED',
        client_name: 'Updated Client Name', vat: 0,
        services: [{ description: 'Service B', qty: 2, unit_price: 50 }]
      })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'invoice.update');
    assert.strictEqual(row.entity_id, invoiceId);
    assert.ok(row.description.includes('Updated Client Name'));
  });

  it('#3 — invoice delete logged', async () => {
    const db = getDb();
    const invoiceId = db.prepare('SELECT id FROM invoices WHERE client_name = ?').get('Updated Client Name').id;

    await admin
      .delete(`/api/invoices/${invoiceId}`)
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'invoice.delete');
    assert.strictEqual(row.entity_id, invoiceId);
    assert.ok(row.description.includes('Updated Client Name'));
  });

  // --- Clients ---

  it('#4 — client create logged', async () => {
    await admin
      .post('/api/clients')
      .send({ name: 'New Activity Client', contact: '555-0001' })
      .expect(201);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'client.create');
    assert.strictEqual(row.entity_type, 'client');
    assert.ok(row.description.includes('New Activity Client'));
    assert.strictEqual(row.username_snapshot, 'testadmin');
  });

  it('#5 — client upsert logged as update', async () => {
    await admin
      .post('/api/clients')
      .send({ name: 'New Activity Client', contact: '555-9999' })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'client.update');
    assert.ok(row.description.includes('New Activity Client'));
    assert.ok(row.description.includes('(upsert)'));
  });

  it('#6 — client update logged', async () => {
    const db = getDb();
    const clientId = db.prepare('SELECT id FROM clients WHERE name = ?').get('New Activity Client').id;

    await admin
      .put(`/api/clients/${clientId}`)
      .send({ name: 'Renamed Client', contact: '555-0002' })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'client.update');
    assert.strictEqual(row.entity_id, clientId);
    assert.ok(row.description.includes('Renamed Client'));
  });

  it('#7 — client delete logged', async () => {
    const db = getDb();
    const clientId = db.prepare('SELECT id FROM clients WHERE name = ?').get('Renamed Client').id;

    await admin
      .delete(`/api/clients/${clientId}`)
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'client.delete');
    assert.strictEqual(row.entity_id, clientId);
    assert.ok(row.description.includes('Renamed Client'));
  });

  // --- Settings ---

  it('#8 — settings update logged', async () => {
    await admin
      .put('/api/settings')
      .send({
        company_name: 'TEST COMPANY', company_subtitle: 'Test Sub',
        invoice_prefix: 'TEST-', default_currency: 'AED', default_vat: 0,
        default_payment_terms: 'Net 30', default_notes: 'Test notes'
      })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'settings.update');
    assert.strictEqual(row.entity_type, 'settings');
    assert.strictEqual(row.entity_id, 1);
    assert.strictEqual(row.description, 'Updated system settings');
    assert.strictEqual(row.username_snapshot, 'testadmin');
  });

  // --- Users ---

  it('#9 — user create logged', async () => {
    await admin
      .post('/api/users')
      .send({ username: 'loguser1', password: 'pass1234', role: 'user' })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'user.create');
    assert.strictEqual(row.entity_type, 'user');
    assert.ok(row.description.includes('loguser1'));
    assert.ok(row.description.includes('role user'));
    assert.strictEqual(row.username_snapshot, 'testadmin');
  });

  it('#10 — user update logged (single field — deactivate)', async () => {
    const db = getDb();
    const targetId = db.prepare('SELECT id FROM users WHERE username = ?').get('loguser1').id;

    await admin
      .put(`/api/users/${targetId}`)
      .send({ is_active: 0 })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'user.update');
    assert.strictEqual(row.entity_id, targetId);
    assert.strictEqual(row.description, 'Updated user loguser1: deactivated');

    // Restore for later tests
    await admin
      .put(`/api/users/${targetId}`)
      .send({ is_active: 1 })
      .expect(200);
  });

  it('#11 — user update logged (multiple fields)', async () => {
    const db = getDb();
    const targetId = db.prepare('SELECT id FROM users WHERE username = ?').get('loguser1').id;

    await admin
      .put(`/api/users/${targetId}`)
      .send({ role: 'user', is_active: 0 })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.description, 'Updated user loguser1: role to user, deactivated');

    // Restore
    await admin
      .put(`/api/users/${targetId}`)
      .send({ role: 'user', is_active: 1 })
      .expect(200);
  });

  it('#12 — user password reset logged', async () => {
    const db = getDb();
    const targetId = db.prepare('SELECT id FROM users WHERE username = ?').get('loguser1').id;

    await admin
      .put(`/api/users/${targetId}/password`)
      .send({ password: 'newpass123' })
      .expect(200);

    const row = lastActivityLog();
    assert.strictEqual(row.action, 'user.password_reset');
    assert.strictEqual(row.entity_id, targetId);
    assert.ok(row.description.includes('loguser1'));
    assert.ok(!row.description.includes('newpass123'), 'must not include password value');
  });

  // --- Failed mutations do NOT log ---

  it('#13 — failed invoice create (400) does NOT log', async () => {
    const before = countActivityLog();

    await admin
      .post('/api/invoices')
      .send({
        pi_no: 'MOE-PI-BAD', invoice_date: '2026-01-01', currency: 'AED',
        client_name: 'Ghost', vat: 0, services: []
      })
      .expect(400);

    const after = countActivityLog();
    assert.strictEqual(after, before, 'no activity_log row for 400');
  });

  it('#14 — failed client delete (409, linked invoices) does NOT log', async () => {
    // Create a client and link an invoice to it
    const clientRes = await admin
      .post('/api/clients')
      .send({ name: 'Linked Client' })
      .expect(201);

    await admin
      .post('/api/invoices')
      .send({
        invoice_date: '2026-01-01', currency: 'AED',
        client_name: 'Linked Client', client_id: clientRes.body.id, vat: 0,
        services: [{ description: 'S', qty: 1, unit_price: 10 }]
      })
      .expect(201);

    const before = countActivityLog();

    await admin
      .delete(`/api/clients/${clientRes.body.id}`)
      .expect(409);

    const after = countActivityLog();
    assert.strictEqual(after, before, 'no activity_log row for 409');
  });

  it('#15 — last-admin protection 409 does NOT log', async () => {
    const before = countActivityLog();
    const adminId = getTestadminId();

    await admin
      .put(`/api/users/${adminId}`)
      .send({ is_active: 0 })
      .expect(409);

    const after = countActivityLog();
    assert.strictEqual(after, before, 'no activity_log row for 409');
  });

  it('#16 — no-op user update (no role/is_active) does NOT log', async () => {
    const db = getDb();
    const targetId = db.prepare('SELECT id FROM users WHERE username = ?').get('loguser1').id;

    const before = countActivityLog();

    await admin
      .put(`/api/users/${targetId}`)
      .send({ unrelated_field: 'value' })
      .expect(200);

    const after = countActivityLog();
    assert.strictEqual(after, before, 'no activity_log row for no-op update');
  });

  // --- username_snapshot persists ---

  it('#17 — public IP populates ip_address and geo columns via async UPDATE', async () => {
    const db = getDb();
    const { logActivity } = require('../src/lib/activity');

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ city: 'TestCity', region: 'TestRegion', country: 'TC', loc: '25.0,55.0' })
    });

    try {
      const publicIp = '93.184.216.34';
      const fakeReq = {
        session: { userId: getTestadminId(), username: 'testadmin' },
        headers: { 'x-forwarded-for': publicIp },
        ip: null,
        connection: null,
      };
      logActivity(db, fakeReq, 'test.geo', 'test', 9999, 'Geo enrichment test');

      const rowId = db.prepare(
        "SELECT id FROM activity_log WHERE action = 'test.geo' ORDER BY id DESC LIMIT 1"
      ).get().id;

      const start = Date.now();
      let row;
      while (Date.now() - start < 1000) {
        row = db.prepare(
          'SELECT ip_address, location_city, location_region, location_country FROM activity_log WHERE id = ?'
        ).get(rowId);
        if (row && row.location_city) break;
        await new Promise(r => setTimeout(r, 10));
      }

      assert.strictEqual(row.ip_address, publicIp);
      assert.strictEqual(row.location_city, 'TestCity');
      assert.strictEqual(row.location_region, 'TestRegion');
      assert.strictEqual(row.location_country, 'TC');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('#18 — username_snapshot persists after user deactivation', async () => {
    // Create a user to later deactivate
    await admin
      .post('/api/users')
      .send({ username: 'snapshotuser', password: 'pass1234', role: 'user' })
      .expect(200);

    const db = getDb();
    const targetId = db.prepare('SELECT id FROM users WHERE username = ?').get('snapshotuser').id;

    // Log an activity as snapshotuser
    const snapshotAgent = request.agent(getApp());
    await snapshotAgent
      .post('/api/auth/login')
      .send({ username: 'snapshotuser', password: 'pass1234' })
      .expect(200);

    await snapshotAgent
      .post('/api/clients')
      .send({ name: 'Snapshot Client' })
      .expect(201);

    // Verify the log entry exists with correct snapshot
    const logEntry = db.prepare(
      'SELECT * FROM activity_log WHERE user_id = ? AND action = ? ORDER BY id DESC LIMIT 1'
    ).get(targetId, 'client.create');
    assert.strictEqual(logEntry.username_snapshot, 'snapshotuser');

    // Deactivate the user
    await admin
      .put(`/api/users/${targetId}`)
      .send({ is_active: 0 })
      .expect(200);

    // Verify the old log entry still has the original username_snapshot
    const afterDeactivate = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(logEntry.id);
    assert.strictEqual(afterDeactivate.username_snapshot, 'snapshotuser',
      'username_snapshot must persist after user deactivation');

    // Restore
    await admin
      .put(`/api/users/${targetId}`)
      .send({ is_active: 1 })
      .expect(200);
  });
});
