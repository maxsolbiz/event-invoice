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
      // pi_no should be auto-generated
      assert.ok(res.body.pi_no, 'response should include pi_no');
    });

    it('should reject non-numeric qty with 400', async () => {
      await adminAgent
        .post('/api/invoices')
        .send({
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
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'User Invoice',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 500 }]
        })
        .expect(201);

      assert.strictEqual(res.body.subtotal, 500);
      assert.strictEqual(res.body.total, 500);
      assert.ok(res.body.pi_no, 'response should include auto-generated pi_no');
    });
  });

  describe('GET /api/invoices', () => {
    it('should list all invoices', async () => {
      const res = await adminAgent
        .get('/api/invoices')
        .expect(200);

      assert.ok(Array.isArray(res.body.invoices));
      // At this point: 1 admin invoice + 1 user invoice = 2 invoices
      assert.strictEqual(res.body.invoices.length, 2);
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
      const originalPiNo = list.body.invoices[0].pi_no;

      const res = await adminAgent
        .put(`/api/invoices/${invoiceId}`)
        .send({
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

      // PI number should be preserved (not changed)
      const after = await adminAgent.get(`/api/invoices/${invoiceId}`);
      assert.strictEqual(after.body.invoice.pi_no, originalPiNo);
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

  describe('GET /api/invoices/next-pi-no', () => {
    it('should return next PI number based on existing invoices', async () => {
      const res = await adminAgent
        .get('/api/invoices/next-pi-no')
        .expect(200);

      assert.ok(res.body.pi_no, 'should return pi_no');
      // Test DB uses prefix 'TEST-', so pi_no should match that pattern
      assert.ok(res.body.pi_no.includes('-'), 'pi_no should contain a dash separator');
      assert.ok(/\d{3}$/.test(res.body.pi_no), 'pi_no should end with 3-digit number');
    });

    it('should increment after creating an invoice', async () => {
      const before = await adminAgent.get('/api/invoices/next-pi-no');

      await adminAgent
        .post('/api/invoices')
        .send({
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Increment Test',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 100 }]
        })
        .expect(201);

      const after = await adminAgent.get('/api/invoices/next-pi-no');
      assert.notStrictEqual(after.body.pi_no, before.body.pi_no,
        'PI number should increment after creation');
    });
  });

  describe('PI number auto-increment', () => {
    it('should generate sequential PI numbers across multiple creations', async () => {
      const res1 = await adminAgent
        .post('/api/invoices')
        .send({
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Seq Client 1',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 100 }]
        })
        .expect(201);

      const res2 = await adminAgent
        .post('/api/invoices')
        .send({
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Seq Client 2',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 200 }]
        })
        .expect(201);

      assert.ok(res1.body.pi_no, 'first invoice should have pi_no');
      assert.ok(res2.body.pi_no, 'second invoice should have pi_no');
      assert.notStrictEqual(res1.body.pi_no, res2.body.pi_no,
        'PI numbers should be different');

      // Verify the numeric parts are sequential
      const num1 = parseInt(res1.body.pi_no.split('-').pop(), 10);
      const num2 = parseInt(res2.body.pi_no.split('-').pop(), 10);
      assert.strictEqual(num2, num1 + 1, 'PI numbers should be sequential');
    });

    it('should ignore client-provided pi_no', async () => {
      const res = await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'HACKED-999',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Ignore Test',
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 100 }]
        })
        .expect(201);

      assert.ok(!res.body.pi_no.includes('HACKED'),
        'client-provided pi_no should be ignored');
    });
  });
});
