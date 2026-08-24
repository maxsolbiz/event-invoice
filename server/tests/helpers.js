const { createApp } = require('../src/app');
const { getDb, initDb } = require('../src/database');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const TEST_DB_DIR = path.join(__dirname, '..', 'data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'invoice.db');
const TEST_SESSIONS_PATH = path.join(TEST_DB_DIR, 'sessions.db');

let app;

function setupTestDb() {
  // Clean databases
  try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
  try { fs.unlinkSync(TEST_SESSIONS_PATH); } catch (e) {}

  process.env.SESSION_SECRET = 'test-secret-key-for-tests';

  app = createApp();
}

function seedTestData() {
  const db = getDb();
  try {
    // Clean existing test data
    db.prepare('DELETE FROM invoice_services').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM clients').run();
    db.prepare('DELETE FROM users WHERE username IN (?, ?)').run('testadmin', 'testuser');

    // Create admin user (or replace if exists)
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT OR REPLACE INTO users(username, password_hash, role) VALUES(?,?,?)')
      .run('testadmin', adminHash, 'admin');

    // Create regular user (or replace if exists)
    const userHash = bcrypt.hashSync('user123', 10);
    db.prepare('INSERT OR REPLACE INTO users(username, password_hash, role) VALUES(?,?,?)')
      .run('testuser', userHash, 'user');

    // Seed settings if empty
    const count = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
    if (count === 0) {
      db.prepare(`INSERT INTO settings(id,company_name,company_subtitle,invoice_prefix,default_currency,default_vat,default_payment_terms,default_notes)
        VALUES(1,?,?,?,?,?,?,?)`).run(
        'TEST COMPANY', 'Test Subtitle', 'TEST-',
        'AED', 0, 'Net 30', 'Test notes'
      );
    }
  } finally {
    // Don't close — shared connection
  }
}

function cleanupTestDb() {
  try { fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
  try { fs.unlinkSync(TEST_SESSIONS_PATH); } catch (e) {}
}

function getApp() {
  return app;
}

module.exports = {
  setupTestDb,
  seedTestData,
  cleanupTestDb,
  getApp
};
