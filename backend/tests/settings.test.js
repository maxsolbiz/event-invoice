const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');
const { getDb } = require('../src/database');

describe('Settings API', () => {
  let adminAgent;
  let userAgent;

  before(async () => {
    setupTestDb();
    seedTestData();

    adminAgent = request.agent(getApp());
    await adminAgent
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' });

    userAgent = request.agent(getApp());
    await userAgent
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'user123' });
  });

  after(() => {
    cleanupTestDb();
  });

  describe('Unauthenticated access', () => {
    it('GET /api/settings should return 401', async () => {
      await request(getApp()).get('/api/settings').expect(401);
    });

    it('PUT /api/settings should return 401', async () => {
      await request(getApp()).put('/api/settings').send({}).expect(401);
    });
  });

  describe('GET /api/settings', () => {
    it('should return settings for admin', async () => {
      const res = await adminAgent
        .get('/api/settings')
        .expect(200);

      assert.ok(res.body.settings);
      assert.strictEqual(res.body.settings.company_name, 'TEST COMPANY');
      assert.strictEqual(res.body.settings.invoice_prefix, 'TEST-');
    });

    it('should return settings for regular user', async () => {
      const res = await userAgent
        .get('/api/settings')
        .expect(200);

      assert.ok(res.body.settings);
    });
  });

  describe('PUT /api/settings', () => {
    it('should allow admin to update settings', async () => {
      const res = await adminAgent
        .put('/api/settings')
        .send({
          company_name: 'NEW COMPANY',
          company_subtitle: 'New Subtitle',
          invoice_prefix: 'NEW-',
          default_currency: 'USD',
          default_vat: 5,
          default_payment_terms: 'Due on receipt',
          default_notes: 'New notes'
        })
        .expect(200);

      assert.strictEqual(res.body.message, 'Settings updated');

      // Verify update
      const getRes = await adminAgent.get('/api/settings');
      assert.strictEqual(getRes.body.settings.company_name, 'NEW COMPANY');
    });

    it('should reject user role from updating settings (403)', async () => {
      await userAgent
        .put('/api/settings')
        .send({ company_name: 'HACKED' })
        .expect(403);
    });

    it('should not change settings after rejected user attempt', async () => {
      const res = await adminAgent.get('/api/settings');
      assert.strictEqual(res.body.settings.company_name, 'NEW COMPANY');
    });
  });

  describe('Company logo and stamp', () => {
    it('should allow admin to update company_logo and company_stamp', async () => {
      const logoDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const stampDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

      await adminAgent
        .put('/api/settings')
        .send({
          company_name: 'TEST COMPANY',
          company_subtitle: 'Test Subtitle',
          invoice_prefix: 'TEST-',
          default_currency: 'AED',
          default_vat: 0,
          default_payment_terms: 'As agreed',
          default_notes: 'Test notes',
          company_logo: logoDataUri,
          company_stamp: stampDataUri
        })
        .expect(200);

      const res = await adminAgent.get('/api/settings').expect(200);
      assert.strictEqual(res.body.settings.company_logo, logoDataUri);
      assert.strictEqual(res.body.settings.company_stamp, stampDataUri);
    });

    it('should return company_logo and company_stamp fields in GET', async () => {
      const res = await adminAgent.get('/api/settings').expect(200);
      assert.ok('company_logo' in res.body.settings);
      assert.ok('company_stamp' in res.body.settings);
    });

    it('should reject user role from updating logo/stamp (403)', async () => {
      await userAgent
        .put('/api/settings')
        .send({ company_name: 'TEST', company_logo: 'data:image/png;base64,abc' })
        .expect(403);
    });

    it('should log activity when settings with images are saved', async () => {
      const countBefore = getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;

      await adminAgent
        .put('/api/settings')
        .send({
          company_name: 'TEST COMPANY',
          company_subtitle: 'Test Subtitle',
          invoice_prefix: 'TEST-',
          default_currency: 'AED',
          default_vat: 0,
          default_payment_terms: 'As agreed',
          default_notes: 'Test notes',
          company_logo: 'data:image/png;base64,updated',
          company_stamp: null
        })
        .expect(200);

      const countAfter = getDb().prepare('SELECT COUNT(*) as c FROM activity_log').get().c;
      assert.strictEqual(countAfter, countBefore + 1);
    });
  });
});
