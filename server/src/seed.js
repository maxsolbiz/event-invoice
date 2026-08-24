const bcrypt = require('bcrypt');
const { getDb, initDb } = require('./database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function seed() {
  console.log('=== Event Invoice System - Admin User Seed ===\n');

  const username = await ask('Enter admin username: ');
  const password = await ask('Enter admin password: ');

  if (!username || !password) {
    console.error('Error: Username and password are required');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters');
    process.exit(1);
  }

  // Initialize database tables
  initDb();

  const db = getDb();
  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      console.error(`Error: User '${username}' already exists`);
      process.exit(1);
    }

    // Hash password and insert
    const saltRounds = 12;
    const passwordHash = bcrypt.hashSync(password, saltRounds);

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).run(username, passwordHash, 'admin');

    console.log(`\nAdmin user created successfully!`);
    console.log(`  ID: ${result.lastInsertRowid}`);
    console.log(`  Username: ${username}`);
    console.log(`  Role: admin`);
    console.log(`  Password hash: ${passwordHash.substring(0, 20)}...`);
    console.log('\nYou can now start the server with: npm start');
  } finally {
    db.close();
  }

  rl.close();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
