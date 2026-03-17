import db from './connection.js';
import bcrypt from 'bcryptjs';

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
      submitter_id   INTEGER NOT NULL REFERENCES users(id),
      assignee_id    INTEGER REFERENCES users(id),
      ai_attempted   INTEGER NOT NULL DEFAULT 0,
      ai_suggestion  TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default settings
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'ai_enabled', 'true');
  await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', 'company_name', 'Sentinel IT');

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
