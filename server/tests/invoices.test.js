const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');

describe('Invoices API', () => {
  let adminAgent;
  let userAgent;

  before(async () => {
    setupTestDb();
    seedTestData();

    // Login as admin
    adminAgent = request.agent(getApp());
    await adminAgent
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' });

    // Login as user
    userAgent = request.agent(getApp());
    await userAgent
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'user123' });
  });

  after(() => {
    cleanupTestDb();
  });

  describe('Unauthenticated access', () => {
    it('GET /api/invoices should return 401', async () => {
      await request(getApp()).get('/api/invoices').expect(401);
    });

    it('POST /api/invoices should return 401', async () => {
      await request(getApp()).post('/api/invoices').send({}).expect(401);
    });

    it('GET /api/invoices/1 should return 401', async () => {
      await request(getApp()).get('/api/invoices/1').expect(401);
    });

    it('PUT /api/invoices/1 should return 401', async () => {
      await request(getApp()).put('/api/invoices/1').send({}).expect(401);
    });

    it('DELETE /api/invoices/1 should return 401', async () => {
      await request(getApp()).delete('/api/invoices/1').expect(401);
    });
  });

  describe('POST /api/invoices — server-side calculation', () => {
    it('should calculate subtotal/total from services, ignoring client values', async () => {
      const res = await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'TEST-001',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Test Client',
          vat: 100,
          // Client tries to fabricate totals
          subtotal: 99999,
          total: 1,
          services: [
            { description: 'Service A', qty: 2, unit_price: 500, amount: 1 },
            { description: 'Service B', qty: 1, unit_price: 1000, amount: 99999 }
          ]
        })
        .expect(201);

      // Server should calculate: subtotal = (2*500) + (1*1000) = 2000, total = 2000 + 100 = 2100
      assert.strictEqual(res.body.subtotal, 2000);
      assert.strictEqual(res.body.total, 2100);
    });

    it('should reject non-numeric qty with 400', async () => {
      await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'TEST-002',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Test',
          vat: 0,
          services: [{ description: 'Svc', qty: 'abc', unit_price: 100 }]
        })
        .expect(400);
    });

    it('should reject non-numeric unit_price with 400', async () => {
      await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'TEST-003',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Test',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 'xyz' }]
        })
        .expect(400);
    });

    it('should reject empty services with 400', async () => {
      await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'TEST-004',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Test',
          vat: 0,
          services: []
        })
        .expect(400);
    });

    it('should allow user role to create invoice', async () => {
      const res = await userAgent
        .post('/api/invoices')
        .send({
          pi_no: 'USER-001',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'User Invoice',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 500 }]
        })
        .expect(201);

      assert.strictEqual(res.body.subtotal, 500);
      assert.strictEqual(res.body.total, 500);
    });
  });

  describe('GET /api/invoices', () => {
    it('should list all invoices', async () => {
      const res = await adminAgent
        .get('/api/invoices')
        .expect(200);

      assert.ok(Array.isArray(res.body.invoices));
      assert.ok(res.body.invoices.length >= 2);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should get invoice with services', async () => {
      const list = await adminAgent.get('/api/invoices');
      const invoiceId = list.body.invoices[0].id;

      const res = await adminAgent
        .get(`/api/invoices/${invoiceId}`)
        .expect(200);

      assert.ok(res.body.invoice);
      assert.ok(Array.isArray(res.body.services));
    });

    it('should return 404 for nonexistent invoice', async () => {
      await adminAgent
        .get('/api/invoices/99999')
        .expect(404);
    });
  });

  describe('PUT /api/invoices/:id', () => {
    it('should recalculate totals on update', async () => {
      const list = await adminAgent.get('/api/invoices');
      const invoiceId = list.body.invoices[0].id;

      const res = await adminAgent
        .put(`/api/invoices/${invoiceId}`)
        .send({
          pi_no: 'UPDATED-001',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Updated Client',
          vat: 50,
          subtotal: 99999,
          total: 1,
          services: [
            { description: 'Updated Svc', qty: 3, unit_price: 200, amount: 1 }
          ]
        })
        .expect(200);

      // Server should calculate: subtotal = 3*200 = 600, total = 600 + 50 = 650
      assert.strictEqual(res.body.subtotal, 600);
      assert.strictEqual(res.body.total, 650);
    });
  });

  describe('DELETE /api/invoices/:id', () => {
    it('should delete invoice and services', async () => {
      const list = await adminAgent.get('/api/invoices');
      const invoiceId = list.body.invoices[0].id;

      await adminAgent
        .delete(`/api/invoices/${invoiceId}`)
        .expect(200);

      await adminAgent
        .get(`/api/invoices/${invoiceId}`)
        .expect(404);
    });

    it('should return 404 for nonexistent invoice', async () => {
      await adminAgent
        .delete('/api/invoices/99999')
        .expect(404);
    });
  });
});
