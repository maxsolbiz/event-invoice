const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'invoice.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function getTestDb() {
  if (!db) {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function resetDb() {
  if (db) {
    try { db.close(); } catch (e) {}
    db = null;
  }
}

function initDb() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      company_name TEXT DEFAULT 'MOMENT ORGANIZER EVENTS MANAGING',
      company_subtitle TEXT DEFAULT 'Event Management & Event Decoration',
      invoice_prefix TEXT DEFAULT 'MOE-PI-',
      default_currency TEXT DEFAULT 'AED',
      default_vat REAL DEFAULT 0,
      default_payment_terms TEXT DEFAULT 'As agreed with the client.',
      default_notes TEXT DEFAULT 'This Proforma Invoice is issued for the above-mentioned event service.'
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pi_no TEXT,
      invoice_date TEXT,
      currency TEXT,
      client_name TEXT,
      client_contact TEXT,
      venue TEXT,
      event_date TEXT,
      event_type TEXT,
      event_note TEXT,
      client_address TEXT,
      vat REAL,
      payment_terms TEXT,
      notes TEXT,
      subtotal REAL,
      total REAL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      sort_order INTEGER,
      description TEXT,
      qty REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL
    );
  `);

  // Schema migration: add is_active column
  try {
    d.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  } catch (e) {
    // Column already exists
  }

  // Schema migration: add password_changed_at column
  try {
    d.exec('ALTER TABLE users ADD COLUMN password_changed_at TEXT');
  } catch (e) {
    // Column already exists
  }

  // Schema migration: add company_logo column
  try {
    d.exec('ALTER TABLE settings ADD COLUMN company_logo TEXT');
  } catch (e) {
    // Column already exists
  }

  // Schema migration: add company_stamp column
  try {
    d.exec('ALTER TABLE settings ADD COLUMN company_stamp TEXT');
  } catch (e) {
    // Column already exists
  }

  // Login events table
  d.exec(`
    CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username_attempted TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT CHECK(failure_reason IN ('wrong_password', 'deactivated', 'nonexistent')),
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Activity log table
  d.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username_snapshot TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed settings if empty
  const count = d.prepare('SELECT COUNT(*) as c FROM settings').get().c;
  if (count === 0) {
    d.prepare(`INSERT INTO settings(id,company_name,company_subtitle,invoice_prefix,default_currency,default_vat,default_payment_terms,default_notes)
      VALUES(1,?,?,?,?,?,?,?)`).run(
      'MOMENT ORGANIZER EVENTS MANAGING',
      'Event Management & Event Decoration',
      'MOE-PI-',
      'AED', 0,
      'As agreed with the client.',
      'This Proforma Invoice is issued for the above-mentioned event service.'
    );
  }
}

module.exports = { getDb, getTestDb, initDb, resetDb, DB_PATH };
