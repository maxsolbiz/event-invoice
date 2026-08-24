const { createApp } = require('../src/app');
const { getDb, resetDb } = require('../src/database');
const bcrypt = require('bcrypt');

let app;

function setupTestDb() {
  // Reset any existing connection
  resetDb();

  // Create app with in-memory database
  app = createApp(true);
}

function seedTestData() {
  const db = getDb();

  // Create admin user
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users(username, password_hash, role) VALUES(?,?,?)')
    .run('testadmin', adminHash, 'admin');

  // Create regular user
  const userHash = bcrypt.hashSync('user123', 10);
  db.prepare('INSERT INTO users(username, password_hash, role) VALUES(?,?,?)')
    .run('testuser', userHash, 'user');

  // Settings already seeded by initDb() with defaults — overwrite with test values
  db.prepare(`UPDATE settings SET company_name=?, invoice_prefix=? WHERE id=1`)
    .run('TEST COMPANY', 'TEST-');
}

function cleanupTestDb() {
  resetDb();
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
