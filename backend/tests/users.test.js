const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');
const { getDb } = require('../src/database');

describe('Users API', () => {
  before(() => {
    setupTestDb();
    seedTestData();
  });

  after(() => {
    cleanupTestDb();
  });

  describe('Authentication and authorization', () => {
    it('#1 — unauthenticated GET /api/users returns 401', async () => {
      await request(getApp())
        .get('/api/users')
        .expect(401);
    });

    it('#2 — user-role GET /api/users returns 403', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'user123' })
        .expect(200);

      await agent
        .get('/api/users')
        .expect(403);
    });

    it('#11 — user-role POST /api/users returns 403', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'user123' })
        .expect(200);

      await agent
        .post('/api/users')
        .send({ username: 'newuser', password: 'pass123', role: 'user' })
        .expect(403);
    });
  });

  describe('GET /api/users', () => {
    it('#3 — admin gets exact user list (2 seeded users)', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const res = await agent
        .get('/api/users')
        .expect(200);

      assert.strictEqual(res.body.users.length, 2);
      assert.strictEqual(res.body.users[0].username, 'testadmin');
      assert.strictEqual(res.body.users[1].username, 'testuser');
    });

    it('#14 — password_hash never appears in response', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const res = await agent
        .get('/api/users')
        .expect(200);

      const bodyStr = JSON.stringify(res.body);
      assert.strictEqual(bodyStr.includes('password_hash'), false);
    });
  });

  describe('POST /api/users', () => {
    it('#4 — admin creates a new user successfully', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const res = await agent
        .post('/api/users')
        .send({ username: 'newadmin', password: 'admin456', role: 'admin' })
        .expect(200);

      assert.ok(res.body.id);
      assert.strictEqual(res.body.message, 'User created');
    });

    it('#5 — duplicate username returns 400', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const res = await agent
        .post('/api/users')
        .send({ username: 'testadmin', password: 'pass1234', role: 'user' })
        .expect(400);

      assert.ok(res.body.error.includes('already exists'));
    });

    it('#6 — invalid role returns 400', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .post('/api/users')
        .send({ username: 'baduser', password: 'pass1234', role: 'superadmin' })
        .expect(400);
    });

    it('#7 — short password returns 400', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .post('/api/users')
        .send({ username: 'shortpw', password: 'abc', role: 'user' })
        .expect(400);
    });
  });

  describe('PUT /api/users/:id — last-admin protection', () => {
    it('#8 — deactivating a non-last admin succeeds', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      // newadmin was created in test #4, deactivate them
      const usersRes = await agent.get('/api/users').expect(200);
      const newadmin = usersRes.body.users.find(u => u.username === 'newadmin');
      assert.ok(newadmin, 'newadmin should exist');

      await agent
        .put(`/api/users/${newadmin.id}`)
        .send({ is_active: 0 })
        .expect(200);
    });

    it('#9 — deactivating the last active admin returns 409', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      // Get testadmin's own id
      const meRes = await agent.get('/api/auth/me').expect(200);
      const adminId = meRes.body.user.id;

      const res = await agent
        .put(`/api/users/${adminId}`)
        .send({ is_active: 0 })
        .expect(409);

      assert.ok(res.body.error.includes('last active admin'));

      // Verify still active in database
      const usersRes = await agent.get('/api/users').expect(200);
      const admin = usersRes.body.users.find(u => u.id === adminId);
      assert.strictEqual(admin.is_active, 1);
    });

    it('#10 — demoting the last active admin returns 409', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const meRes = await agent.get('/api/auth/me').expect(200);
      const adminId = meRes.body.user.id;

      const res = await agent
        .put(`/api/users/${adminId}`)
        .send({ role: 'user' })
        .expect(409);

      assert.ok(res.body.error.includes('last active admin'));

      // Verify still admin in database
      const usersRes = await agent.get('/api/users').expect(200);
      const admin = usersRes.body.users.find(u => u.id === adminId);
      assert.strictEqual(admin.role, 'admin');
    });

    it('#15 — PUT nonexistent user id returns 404', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .put('/api/users/99999')
        .send({ role: 'user' })
        .expect(404);
    });
  });

  describe('PUT /api/users/:id/password', () => {
    it('#13 — admin resets password successfully', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const usersRes = await agent.get('/api/users').expect(200);
      const testuser = usersRes.body.users.find(u => u.username === 'testuser');

      await agent
        .put(`/api/users/${testuser.id}/password`)
        .send({ password: 'newpass456' })
        .expect(200);

      // Verify new password works
      await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'newpass456' })
        .expect(200);
    });

    it('#16 — PUT password for nonexistent user returns 404', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .put('/api/users/99999/password')
        .send({ password: 'newpass789' })
        .expect(404);
    });
  });

  describe('Admin self-change when second admin exists', () => {
    it('#19 — admin can self-deactivate when another active admin exists', async () => {
      // Create a second admin first (using testadmin)
      const setup = request.agent(getApp());
      await setup
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await setup
        .post('/api/users')
        .send({ username: 'selfdeactivate', password: 'pass1234', role: 'admin' })
        .expect(200);

      // Verifier logs in as the NEW admin (not testadmin) so session survives testadmin's deactivation
      const verifier = request.agent(getApp());
      await verifier
        .post('/api/auth/login')
        .send({ username: 'selfdeactivate', password: 'pass1234' })
        .expect(200);

      // Log in as testadmin and self-deactivate
      const selfAgent = request.agent(getApp());
      await selfAgent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const meRes = await selfAgent.get('/api/auth/me').expect(200);
      const myId = meRes.body.user.id;

      await selfAgent
        .put(`/api/users/${myId}`)
        .send({ is_active: 0 })
        .expect(200);

      // Verifier (authenticated as selfdeactivate, still active) confirms testadmin is inactive
      const usersRes = await verifier.get('/api/users').expect(200);
      const me = usersRes.body.users.find(u => u.id === myId);
      assert.strictEqual(me.is_active, 0);

      // Restore testadmin for remaining tests
      await verifier
        .put(`/api/users/${myId}`)
        .send({ is_active: 1 })
        .expect(200);
    });

    it('#20 — admin can self-demotion when another active admin exists', async () => {
      // Create a second admin first (using testadmin)
      const setup = request.agent(getApp());
      await setup
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await setup
        .post('/api/users')
        .send({ username: 'selfdemote', password: 'pass1234', role: 'admin' })
        .expect(200);

      // Verifier logs in as the NEW admin (not testadmin) so session survives testadmin's demotion
      const verifier = request.agent(getApp());
      await verifier
        .post('/api/auth/login')
        .send({ username: 'selfdemote', password: 'pass1234' })
        .expect(200);

      // Log in as testadmin and self-demotion to user
      const selfAgent = request.agent(getApp());
      await selfAgent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const meRes = await selfAgent.get('/api/auth/me').expect(200);
      const myId = meRes.body.user.id;

      await selfAgent
        .put(`/api/users/${myId}`)
        .send({ role: 'user' })
        .expect(200);

      // Verifier (authenticated as selfdemote, still active) confirms testadmin is now role 'user'
      const usersRes = await verifier.get('/api/users').expect(200);
      const me = usersRes.body.users.find(u => u.id === myId);
      assert.strictEqual(me.role, 'user');

      // Restore testadmin to admin for remaining tests
      await verifier
        .put(`/api/users/${myId}`)
        .send({ role: 'admin' })
        .expect(200);
    });
  });

  describe('Deactivated user login', () => {
    it('#12 — deactivated user gets generic 401', async () => {
      const adminAgent = request.agent(getApp());
      await adminAgent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      // Create a user to deactivate
      await adminAgent
        .post('/api/users')
        .send({ username: 'to deactivate', password: 'pass1234', role: 'user' })
        .expect(200);

      const usersRes = await adminAgent.get('/api/users').expect(200);
      const target = usersRes.body.users.find(u => u.username === 'to deactivate');

      await adminAgent
        .put(`/api/users/${target.id}`)
        .send({ is_active: 0 })
        .expect(200);

      // Deactivated user login — same 401 as wrong password
      const res = await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'to deactivate', password: 'pass1234' })
        .expect(401);

      assert.strictEqual(res.body.error, 'Invalid credentials');
    });
  });

  describe('Session revocation', () => {
    it('#17 — deactivated user existing session rejected', async () => {
      // Login as testuser (with fresh password from test #13)
      const userAgent = request.agent(getApp());
      await userAgent
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'newpass456' })
        .expect(200);

      // Verify session works
      await userAgent
        .get('/api/invoices')
        .expect(200);

      // Admin deactivates testuser
      const adminAgent = request.agent(getApp());
      await adminAgent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const usersRes = await adminAgent.get('/api/users').expect(200);
      const testuserId = usersRes.body.users.find(u => u.username === 'testuser').id;

      await adminAgent
        .put(`/api/users/${testuserId}`)
        .send({ is_active: 0 })
        .expect(200);

      // testuser's original session is now rejected
      await userAgent
        .get('/api/invoices')
        .expect(401);
    });

    it('#18 — password-reset user existing session rejected', async () => {
      // Create a fresh user for this test
      const adminAgent = request.agent(getApp());
      await adminAgent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await adminAgent
        .post('/api/users')
        .send({ username: 'resetsession', password: 'pass1234', role: 'user' })
        .expect(200);

      // Login as the new user
      const userAgent = request.agent(getApp());
      await userAgent
        .post('/api/auth/login')
        .send({ username: 'resetsession', password: 'pass1234' })
        .expect(200);

      // Verify session works
      await userAgent
        .get('/api/invoices')
        .expect(200);

      // Small delay to guarantee password_changed_at > loginTimestamp
      await new Promise(r => setTimeout(r, 10));

      // Admin resets the user's password
      const usersRes = await adminAgent.get('/api/users').expect(200);
      const targetId = usersRes.body.users.find(u => u.username === 'resetsession').id;

      await adminAgent
        .put(`/api/users/${targetId}/password`)
        .send({ password: 'newpass789' })
        .expect(200);

      // Original session is now rejected
      await userAgent
        .get('/api/invoices')
        .expect(401);
    });
  });

  describe('PUT /api/users/:id — username editing', () => {
    it('#21 — admin updates username successfully', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .post('/api/users')
        .send({ username: 'rename_me', password: 'pass1234', role: 'user' })
        .expect(200);

      const usersRes = await agent.get('/api/users').expect(200);
      const target = usersRes.body.users.find(u => u.username === 'rename_me');

      await agent
        .put(`/api/users/${target.id}`)
        .send({ username: 'renamed_user' })
        .expect(200);

      const updated = await agent.get('/api/users').expect(200);
      const found = updated.body.users.find(u => u.id === target.id);
      assert.strictEqual(found.username, 'renamed_user');
    });

    it('#22 — duplicate username returns 400', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const usersRes = await agent.get('/api/users').expect(200);
      const target = usersRes.body.users.find(u => u.username === 'renamed_user');

      await agent
        .put(`/api/users/${target.id}`)
        .send({ username: 'testadmin' })
        .expect(400);
    });

    it('#23 — username update logged in activity_log', async () => {
      const agent = request.agent(getApp());
      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const countBefore = getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;

      const usersRes = await agent.get('/api/users').expect(200);
      const target = usersRes.body.users.find(u => u.username === 'renamed_user');

      await agent
        .put(`/api/users/${target.id}`)
        .send({ username: 'final_name' })
        .expect(200);

      const countAfter = getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;
      assert.strictEqual(countAfter, countBefore + 1);

      const last = getDb().prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 1').get();
      assert.strictEqual(last.action, 'user.update');
      assert.strictEqual(last.entity_type, 'user');
      assert.strictEqual(last.entity_id, target.id);
      assert.ok(last.description.includes('renamed to final_name'));
    });
  });
});
