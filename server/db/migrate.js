import db from './connection.js';
import bcrypt from 'bcryptjs';

async function addColumnIfMissing(table, column, definition) {
  await db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

export async function runMigrations() {
  // Run each CREATE TABLE separately (pg doesn't support multi-statement exec)
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'employee'
                 CHECK(role IN ('employee', 'it_staff', 'admin')),
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id                SERIAL PRIMARY KEY,
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'open'
                        CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority          TEXT NOT NULL DEFAULT 'medium'
                        CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      category          TEXT NOT NULL DEFAULT 'software'
                        CHECK(category IN ('hardware', 'software', 'network', 'access', 'account')),
      submitter_id      INTEGER NOT NULL REFERENCES users(id),
      assignee_id       INTEGER REFERENCES users(id),
      ai_attempted      INTEGER NOT NULL DEFAULT 0,
      ai_suggestion     TEXT,
      sentiment         TEXT,
      atlas_suggestions TEXT,
      resolution_report TEXT,
      ai_auto_assigned  INTEGER NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at       TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_comments (
      id         SERIAL PRIMARY KEY,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_notes (
      id         SERIAL PRIMARY KEY,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_attachments (
      id          SERIAL PRIMARY KEY,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      filename    TEXT NOT NULL,
      original    TEXT NOT NULL,
      size        INTEGER NOT NULL,
      mimetype    TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_history (
      id         SERIAL PRIMARY KEY,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      action     TEXT NOT NULL,
      from_val   TEXT,
      to_val     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS knowledge_base (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'software',
      problem     TEXT NOT NULL,
      solution    TEXT NOT NULL,
      steps       TEXT,
      ticket_id   INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      views       INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS company_profile (
      id               SERIAL PRIMARY KEY,
      company_name     TEXT,
      industry         TEXT,
      employee_count   TEXT,
      it_staff_count   TEXT,
      os_types         TEXT,
      email_platform   TEXT,
      comm_tools       TEXT,
      other_software   TEXT,
      common_issues    TEXT,
      recurring_issues TEXT,
      problem_systems  TEXT,
      has_vpn          INTEGER NOT NULL DEFAULT 0,
      network_equipment TEXT,
      infrastructure   TEXT,
      compliance_reqs  TEXT,
      atlas_style      TEXT NOT NULL DEFAULT 'balanced',
      atlas_clarify    INTEGER NOT NULL DEFAULT 1,
      completed        INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS employee_profiles (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      department       TEXT,
      device_type      TEXT,
      primary_software TEXT,
      tenure_months    INTEGER,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS learned_solutions (
      id               SERIAL PRIMARY KEY,
      category         TEXT NOT NULL,
      problem_summary  TEXT NOT NULL,
      problem_keywords TEXT NOT NULL DEFAULT '[]',
      solution_text    TEXT NOT NULL,
      success_count    INTEGER NOT NULL DEFAULT 0,
      tried_count      INTEGER NOT NULL DEFAULT 0,
      success_rate     REAL NOT NULL DEFAULT 0,
      kb_article_id    INTEGER REFERENCES knowledge_base(id) ON DELETE SET NULL,
      source_ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      last_used_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ];

  for (const sql of tables) {
    await db.run(sql);
  }

  // Add new columns to existing tables if they don't exist yet
  await addColumnIfMissing('tickets', 'category',           "TEXT NOT NULL DEFAULT 'software'");
  await addColumnIfMissing('tickets', 'resolved_at',        'TIMESTAMPTZ');
  await addColumnIfMissing('tickets', 'sentiment',          'TEXT');
  await addColumnIfMissing('tickets', 'atlas_suggestions',  'TEXT');
  await addColumnIfMissing('tickets', 'resolution_report',  'TEXT');
  await addColumnIfMissing('tickets', 'ai_auto_assigned',   'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('tickets', 'solution',           'TEXT');

  // Seed default settings
  const settingSeeds = [
    ['ai_enabled',    'true'],
    ['company_name',  'Sentinel IT'],
    ['smtp_host',     ''],
    ['smtp_port',     '587'],
    ['smtp_user',     ''],
    ['smtp_pass',     ''],
    ['smtp_from',     ''],
    ['smtp_secure',   'false'],
  ];
  for (const [key, value] of settingSeeds) {
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING',
      key, value
    );
  }

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
