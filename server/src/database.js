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

module.exports = { getDb, initDb, DB_PATH };
