import db from './connection.js';
import bcrypt from 'bcryptjs';

async function addColumnIfMissing(table, column, definition) {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (e) {
    // Column already exists — that's fine
  }
}

export async function runMigrations() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'employee'
                 CHECK(role IN ('employee', 'it_staff', 'admin')),
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'open'
                     CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority       TEXT NOT NULL DEFAULT 'medium'
                     CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      category       TEXT NOT NULL DEFAULT 'software'
                     CHECK(category IN ('hardware', 'software', 'network', 'access', 'account')),
      submitter_id   INTEGER NOT NULL REFERENCES users(id),
      assignee_id    INTEGER REFERENCES users(id),
      ai_attempted   INTEGER NOT NULL DEFAULT 0,
      ai_suggestion  TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      filename    TEXT NOT NULL,
      original    TEXT NOT NULL,
      size        INTEGER NOT NULL,
      mimetype    TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Add new columns to existing tables if they don't exist yet
  await addColumnIfMissing('tickets', 'category', "TEXT NOT NULL DEFAULT 'software'");
  await addColumnIfMissing('tickets', 'resolved_at', 'TEXT');

  // Seed default settings
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'ai_enabled', 'true');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'company_name', 'Sentinel IT');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_host', '');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_port', '587');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_user', '');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_pass', '');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_from', '');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'smtp_secure', 'false');

  // Seed default admin if no users exist
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('420699202005', 10);
    await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      'Admin User', 'iguinn141@gmail.com', hash, 'admin'
    );
    console.log('✓ Seeded default admin: iguinn141@gmail.com');
  }
}
