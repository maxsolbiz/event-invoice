const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware');
const { logActivity } = require('../lib/activity');

const router = express.Router();

// All invoice routes require authentication
router.use(requireAuth);

// Helper: generate next PI number from DB
function generateNextPiNo(db) {
  const settings = db.prepare('SELECT invoice_prefix FROM settings WHERE id = 1').get();
  const prefix = settings?.invoice_prefix || 'MOE-PI-';

  const last = db.prepare(
    "SELECT pi_no FROM invoices WHERE pi_no LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(prefix + '%');

  let nextNum = 1;
  if (last && last.pi_no) {
    const suffix = last.pi_no.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }

  return prefix + String(nextNum).padStart(3, '0');
}

// GET /api/invoices/next-pi-no — return the next auto-generated PI number
router.get('/next-pi-no', (req, res) => {
  const db = getDb();
  try {
    const pi_no = generateNextPiNo(db);
    res.json({ pi_no });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PI number' });
  }
});

// Helper: validate and recalculate totals from services
function validateAndCalculate(services, vat) {
  if (!Array.isArray(services) || services.length === 0) {
    return { error: 'At least one service is required' };
  }

  const cleanedServices = [];
  let subtotal = 0;

  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const qty = Number(s.qty);
    const unitPrice = Number(s.unit_price);

    if (isNaN(qty) || qty < 0) {
      return { error: `Service ${i + 1}: qty must be a non-negative number` };
    }
    if (isNaN(unitPrice) || unitPrice < 0) {
      return { error: `Service ${i + 1}: unit_price must be a non-negative number` };
    }

    const amount = qty * unitPrice;
    subtotal += amount;

    cleanedServices.push({
      description: String(s.description || ''),
      qty,
      unit_price: unitPrice,
      amount
    });
  }

  const vatNum = Number(vat);
  if (isNaN(vatNum) || vatNum < 0) {
    return { error: 'vat must be a non-negative number' };
  }

  const total = subtotal + vatNum;

  return { cleanedServices, subtotal, total };
}

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
      invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, client_id, services
    } = req.body;

    // Server-side calculation — never trust client subtotal/total
    const calc = validateAndCalculate(services, vat);
    if (calc.error) {
      return res.status(400).json({ error: calc.error });
    }

    // Auto-generate PI number — ignore any client-provided value
    const pi_no = generateNextPiNo(db);

    let invoiceId;
    const createInvoice = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO invoices(pi_no, invoice_date, currency, client_name, client_contact,
          venue, event_date, event_type, event_note, client_address,
          vat, payment_terms, notes, subtotal, total, client_id, created_by)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        pi_no, invoice_date, currency, client_name, client_contact,
        venue, event_date, event_type, event_note, client_address,
        Number(vat), payment_terms, notes, calc.subtotal, calc.total,
        client_id || null, req.session.userId
      );

      invoiceId = result.lastInsertRowid;

      const insertService = db.prepare(`
        INSERT INTO invoice_services(invoice_id, sort_order, description, qty, unit_price, amount)
        VALUES(?,?,?,?,?,?)
      `);
      calc.cleanedServices.forEach((s, i) => {
        insertService.run(invoiceId, i + 1, s.description, s.qty, s.unit_price, s.amount);
      });
    });
    createInvoice();

    logActivity(db, req, 'invoice.create', 'invoice', invoiceId,
      `Created invoice ${pi_no} for ${client_name || ''}`);

    res.status(201).json({
      id: invoiceId,
      pi_no,
      subtotal: calc.subtotal,
      total: calc.total,
      message: 'Invoice created'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoices/:id — update invoice and replace services
router.put('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id, pi_no FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const {
      invoice_date, currency, client_name, client_contact,
      venue, event_date, event_type, event_note, client_address,
      vat, payment_terms, notes, client_id, services
    } = req.body;

    // Server-side calculation — never trust client subtotal/total
    const calc = validateAndCalculate(services, vat);
    if (calc.error) {
      return res.status(400).json({ error: calc.error });
    }

    // PI number is immutable — always use the existing value
    const pi_no = existing.pi_no;

    const updateInvoice = db.transaction(() => {
      db.prepare(`
        UPDATE invoices SET pi_no=?, invoice_date=?, currency=?, client_name=?, client_contact=?,
          venue=?, event_date=?, event_type=?, event_note=?, client_address=?,
          vat=?, payment_terms=?, notes=?, subtotal=?, total=?, client_id=?
        WHERE id=?
      `).run(
        pi_no, invoice_date, currency, client_name, client_contact,
        venue, event_date, event_type, event_note, client_address,
        Number(vat), payment_terms, notes, calc.subtotal, calc.total,
        client_id || null, req.params.id
      );

      // Replace services
      db.prepare('DELETE FROM invoice_services WHERE invoice_id = ?').run(req.params.id);
      const insertService = db.prepare(`
        INSERT INTO invoice_services(invoice_id, sort_order, description, qty, unit_price, amount)
        VALUES(?,?,?,?,?,?)
      `);
      calc.cleanedServices.forEach((s, i) => {
        insertService.run(req.params.id, i + 1, s.description, s.qty, s.unit_price, s.amount);
      });
    });
    updateInvoice();

    logActivity(db, req, 'invoice.update', 'invoice', Number(req.params.id),
      `Updated invoice ${pi_no} for ${client_name || ''}`);

    res.json({
      subtotal: calc.subtotal,
      total: calc.total,
      message: 'Invoice updated'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE /api/invoices/:id — delete invoice and services
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id, pi_no, client_name FROM invoices WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    db.prepare('DELETE FROM invoice_services WHERE invoice_id = ?').run(req.params.id);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);

    logActivity(db, req, 'invoice.delete', 'invoice', Number(req.params.id),
      `Deleted invoice ${existing.pi_no || ''} for ${existing.client_name || ''}`);

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
