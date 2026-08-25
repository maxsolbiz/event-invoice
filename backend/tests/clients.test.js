const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { setupTestDb, seedTestData, cleanupTestDb, getApp } = require('./helpers');

describe('Clients API', () => {
  let adminAgent;

  before(async () => {
    setupTestDb();
    seedTestData();

    adminAgent = request.agent(getApp());
    await adminAgent
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'admin123' });
  });

  after(() => {
    cleanupTestDb();
  });

  describe('Unauthenticated access', () => {
    it('GET /api/clients should return 401', async () => {
      await request(getApp()).get('/api/clients').expect(401);
    });

    it('POST /api/clients should return 401', async () => {
      await request(getApp()).post('/api/clients').send({}).expect(401);
    });

    it('GET /api/clients/1 should return 401', async () => {
      await request(getApp()).get('/api/clients/1').expect(401);
    });

    it('PUT /api/clients/1 should return 401', async () => {
      await request(getApp()).put('/api/clients/1').send({}).expect(401);
    });

    it('DELETE /api/clients/1 should return 401', async () => {
      await request(getApp()).delete('/api/clients/1').expect(401);
    });
  });

  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const res = await adminAgent
        .post('/api/clients')
        .send({ name: 'Acme Corp', contact: '+971501234567', address: 'Dubai' })
        .expect(201);

      assert.ok(res.body.id);
      assert.strictEqual(res.body.message, 'Client created');
    });

    it('should upsert client with duplicate name', async () => {
      const res = await adminAgent
        .post('/api/clients')
        .send({ name: 'Acme Corp', contact: '+971509999999' })
        .expect(200);

      assert.strictEqual(res.body.message, 'Client updated');
    });

    it('should reject missing name with 400', async () => {
      await adminAgent
        .post('/api/clients')
        .send({ contact: '+971501234567' })
        .expect(400);
    });
  });

  describe('GET /api/clients', () => {
    it('should list all clients', async () => {
      const res = await adminAgent
        .get('/api/clients')
        .expect(200);

      assert.ok(Array.isArray(res.body.clients));
      // At this point: Acme Corp created (upsert doesn't add new row) = 1 client
      assert.strictEqual(res.body.clients.length, 1);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should delete client without linked invoices', async () => {
      // Create a client to delete
      const createRes = await adminAgent
        .post('/api/clients')
        .send({ name: 'Delete Me Inc' });

      const clientId = createRes.body.id;

      await adminAgent
        .delete(`/api/clients/${clientId}`)
        .expect(200);
    });

    it('should reject deleting client with linked invoices (409)', async () => {
      // Create client
      const clientRes = await adminAgent
        .post('/api/clients')
        .send({ name: 'Linked Client' });

      // Create invoice linked to client
      await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'LINK-001',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Linked Client',
          client_id: clientRes.body.id,
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 100 }]
        });

      // Try to delete — should fail
      await adminAgent
        .delete(`/api/clients/${clientRes.body.id}`)
        .expect(409);
    });

    it('should return 404 for nonexistent client', async () => {
      await adminAgent
        .delete('/api/clients/99999')
        .expect(404);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update client fields', async () => {
      const createRes = await adminAgent
        .post('/api/clients')
        .send({ name: 'Edit Me', contact: 'old', address: 'old addr' });

      const clientId = createRes.body.id;

      const res = await adminAgent
        .put(`/api/clients/${clientId}`)
        .send({ name: 'Edited Corp', contact: '+971509999999', address: 'New Address' })
        .expect(200);

      assert.strictEqual(res.body.message, 'Client updated');

      // Verify update persisted
      const getRes = await adminAgent.get(`/api/clients/${clientId}`).expect(200);
      assert.strictEqual(getRes.body.client.name, 'Edited Corp');
      assert.strictEqual(getRes.body.client.contact, '+971509999999');
      assert.strictEqual(getRes.body.client.address, 'New Address');
    });

    it('should return 404 for nonexistent client', async () => {
      await adminAgent
        .put('/api/clients/99999')
        .send({ name: 'Nobody' })
        .expect(404);
    });

    it('should reject empty name with 400', async () => {
      const createRes = await adminAgent
        .post('/api/clients')
        .send({ name: 'Validate Me' });

      await adminAgent
        .put(`/api/clients/${createRes.body.id}`)
        .send({ name: '' })
        .expect(400);
    });

    it('should not mutate invoice snapshots when client name changes', async () => {
      // Create client
      const clientRes = await adminAgent
        .post('/api/clients')
        .send({ name: 'Snapshot Client' });

      const clientId = clientRes.body.id;

      // Create invoice linked to client
      const invoiceRes = await adminAgent
        .post('/api/invoices')
        .send({
          pi_no: 'SNAP-001',
          invoice_date: '2026-08-25',
          currency: 'AED',
          client_name: 'Snapshot Client',
          client_id: clientId,
          vat: 0,
          services: [{ description: 'Svc', qty: 1, unit_price: 100 }]
        });

      // Rename the client
      await adminAgent
        .put(`/api/clients/${clientId}`)
        .send({ name: 'Renamed Client' })
        .expect(200);

      // Verify invoice still has original name
      const invoiceGetRes = await adminAgent
        .get(`/api/invoices/${invoiceRes.body.id}`)
        .expect(200);

      assert.strictEqual(invoiceGetRes.body.invoice.client_name, 'Snapshot Client');
    });
  });
});
