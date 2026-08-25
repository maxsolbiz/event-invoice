const express = require('express');
const { getDb } = require('../database');
const { requireAuth, requireRole } = require('../middleware');
const { logActivity } = require('../lib/activity');

const router = express.Router();

// All settings routes require authentication
router.use(requireAuth);

// GET /api/settings — get current settings (any authenticated user)
router.get('/', (req, res) => {
  const db = getDb();
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings — update settings (admin only)
router.put('/', requireRole('admin'), (req, res) => {
  const db = getDb();
  try {
    const {
      company_name, company_subtitle, invoice_prefix,
      default_currency, default_vat, default_payment_terms, default_notes,
      company_logo, company_stamp
    } = req.body;

    const MAX_BASE64_SIZE = 500 * 1024; // 500KB
    if (company_logo && company_logo.length > MAX_BASE64_SIZE) {
      return res.status(400).json({ error: 'Company logo exceeds 500KB limit' });
    }
    if (company_stamp && company_stamp.length > MAX_BASE64_SIZE) {
      return res.status(400).json({ error: 'Company stamp exceeds 500KB limit' });
    }

    db.prepare(`
      UPDATE settings SET
        company_name=?, company_subtitle=?, invoice_prefix=?,
        default_currency=?, default_vat=?, default_payment_terms=?, default_notes=?,
        company_logo=?, company_stamp=?
      WHERE id=1
    `).run(
      company_name, company_subtitle, invoice_prefix,
      default_currency, default_vat, default_payment_terms, default_notes,
      company_logo || null, company_stamp || null
    );

    logActivity(db, req, 'settings.update', 'settings', 1, 'Updated system settings');

    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
