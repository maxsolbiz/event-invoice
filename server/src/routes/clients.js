const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/clients — list all clients
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/clients/:id — get single client
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ client });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// POST /api/clients — create or upsert client
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const { name, contact, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    const existing = db.prepare('SELECT id FROM clients WHERE name = ?').get(name);
    if (existing) {
      db.prepare('UPDATE clients SET contact=?, address=? WHERE id=?')
        .run(contact || null, address || null, existing.id);
      res.json({ id: existing.id, message: 'Client updated' });
    } else {
      const result = db.prepare('INSERT INTO clients(name, contact, address) VALUES(?,?,?)')
        .run(name, contact || null, address || null);
      res.status(201).json({ id: result.lastInsertRowid, message: 'Client created' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to save client' });
  }
});

// PUT /api/clients/:id — update client
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { name, contact, address } = req.body;
    db.prepare('UPDATE clients SET name=?, contact=?, address=? WHERE id=?')
      .run(name, contact || null, address || null, req.params.id);
    res.json({ message: 'Client updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id — delete client (only if no linked invoices)
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const linked = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE client_id = ?').get(req.params.id);
    if (linked.c > 0) {
      return res.status(409).json({ error: 'Cannot delete client with existing invoices' });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
