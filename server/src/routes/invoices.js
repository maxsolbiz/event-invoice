const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET /api/invoices — list all invoices
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const invoices = db.prepare(`
      SELECT id, pi_no, client_name, invoice_date, currency, total, client_id, created_at
      FROM invoices ORDER BY id DESC
    `).all();
    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoices/:id — get single invoice with services
router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const services = db.prepare(
      'SELECT * FROM invoice_services WHERE invoice_id = ? ORDER BY sort_order'
    ).all(req.params.id);
    res.json({ invoice, services });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoices — create invoice with services
router.post('/', (req, res) => {
  const db = getDb();
  try {
    const {
      pi_no, invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, subtotal, total, client_id, services
    } = req.body;

    const result = db.prepare(`
      INSERT INTO invoices(pi_no, invoice_date, currency, client_name, client_contact,
        venue, event_date, event_type, event_note, client_address,
        vat, payment_terms, notes, subtotal, total, client_id, created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      pi_no, invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, subtotal, total, client_id || null,
      req.session.userId
    );

    const invoiceId = result.lastInsertRowid;

    if (services && services.length > 0) {
      const insertService = db.prepare(`
        INSERT INTO invoice_services(invoice_id, sort_order, description, qty, unit_price, amount)
        VALUES(?,?,?,?,?,?)
      `);
      services.forEach((s, i) => {
        insertService.run(invoiceId, i + 1, s.description, s.qty, s.unit_price, s.amount);
      });
    }

    res.status(201).json({ id: invoiceId, message: 'Invoice created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id — update invoice and replace services
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const {
      pi_no, invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, subtotal, total, client_id, services
    } = req.body;

    db.prepare(`
      UPDATE invoices SET pi_no=?, invoice_date=?, currency=?, client_name=?, client_contact=?,
        venue=?, event_date=?, event_type=?, event_note=?, client_address=?,
        vat=?, payment_terms=?, notes=?, subtotal=?, total=?, client_id=?
      WHERE id=?
    `).run(
      pi_no, invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, subtotal, total, client_id || null,
      req.params.id
    );

    // Replace services
    db.prepare('DELETE FROM invoice_services WHERE invoice_id = ?').run(req.params.id);
    if (services && services.length > 0) {
      const insertService = db.prepare(`
        INSERT INTO invoice_services(invoice_id, sort_order, description, qty, unit_price, amount)
        VALUES(?,?,?,?,?,?)
      `);
      services.forEach((s, i) => {
        insertService.run(req.params.id, i + 1, s.description, s.qty, s.unit_price, s.amount);
      });
    }

    res.json({ message: 'Invoice updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE /api/invoices/:id — delete invoice and services
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.prepare('DELETE FROM invoice_services WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
