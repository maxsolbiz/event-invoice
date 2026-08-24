const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');

describe('Auth API', () => {
  before(() => {
    setupTestDb();
    seedTestData();
  });

  after(() => {
    cleanupTestDb();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      assert.strictEqual(res.body.user.username, 'testadmin');
      assert.strictEqual(res.body.user.role, 'admin');
    });

    it('should reject wrong password with 401', async () => {
      await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'wrong' })
        .expect(401);
    });

    it('should reject nonexistent user with same 401 (no enumeration)', async () => {
      await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'whatever' })
        .expect(401);
    });

    it('should reject missing fields with 400', async () => {
      await request(getApp())
        .post('/api/auth/login')
        .send({ username: 'testadmin' })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      await request(getApp())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return user info when authenticated', async () => {
      const agent = request.agent(getApp());

      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      const res = await agent
        .get('/api/auth/me')
        .expect(200);

      assert.strictEqual(res.body.user.username, 'testadmin');
      assert.strictEqual(res.body.user.role, 'admin');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session', async () => {
      const agent = request.agent(getApp());

      await agent
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'admin123' })
        .expect(200);

      await agent
        .post('/api/auth/logout')
        .expect(200);

      await agent
        .get('/api/auth/me')
        .expect(401);
    });
  });
});
