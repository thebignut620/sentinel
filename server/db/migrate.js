import db from './connection.js';
import bcrypt from 'bcryptjs';

async function addColumnIfMissing(table, column, definition) {
  await db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

export async function runMigrations() {
  // Run each CREATE TABLE separately (pg doesn't support multi-statement exec)
  const tables = [
    `CREATE TABLE IF NOT EXISTS companies (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
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
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0,
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
    `CREATE TABLE IF NOT EXISTS integrations (
      id            SERIAL PRIMARY KEY,
      provider      TEXT NOT NULL DEFAULT 'google',
      access_token  TEXT,
      refresh_token TEXT,
      token_expiry  TIMESTAMPTZ,
      connected_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      connected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sync_at  TIMESTAMPTZ,
      is_active     INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS atlas_actions (
      id            SERIAL PRIMARY KEY,
      ticket_id     INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      action_type   TEXT NOT NULL CHECK(action_type IN ('password_reset','account_unlock','access_grant')),
      target_email  TEXT NOT NULL,
      target_name   TEXT,
      details       TEXT,
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','approved','denied','executed','failed')),
      requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approved_at   TIMESTAMPTZ,
      executed_at   TIMESTAMPTZ,
      result        TEXT,
      error_message TEXT
    )`,
    // Phase 3 tables
    `CREATE TABLE IF NOT EXISTS departments (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS assets (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      asset_type       TEXT NOT NULL CHECK(asset_type IN ('laptop','desktop','monitor','phone','printer','tablet','server','other')),
      serial_number    TEXT UNIQUE,
      manufacturer     TEXT,
      model            TEXT,
      purchase_date    DATE,
      warranty_expiry  DATE,
      assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status           TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired','in_repair','storage')),
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS asset_maintenance (
      id          SERIAL PRIMARY KEY,
      asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      cost        NUMERIC(10,2),
      performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_assets (
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      asset_id  INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (ticket_id, asset_id)
    )`,
    `CREATE TABLE IF NOT EXISTS maintenance_windows (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      description  TEXT,
      starts_at    TIMESTAMPTZ NOT NULL,
      ends_at      TIMESTAMPTZ NOT NULL,
      notify_users INTEGER NOT NULL DEFAULT 1,
      notified_at  TIMESTAMPTZ,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS custom_fields (
      id          SERIAL PRIMARY KEY,
      category    TEXT NOT NULL,
      field_name  TEXT NOT NULL,
      field_label TEXT NOT NULL,
      field_type  TEXT NOT NULL DEFAULT 'text' CHECK(field_type IN ('text','textarea','select','number')),
      options     TEXT,
      required    INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name   TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      details     TEXT,
      ip_address  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role            TEXT NOT NULL,
      permission_key  TEXT NOT NULL,
      PRIMARY KEY (role, permission_key)
    )`,
    // Phase 4 tables
    `CREATE TABLE IF NOT EXISTS webhooks (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      url        TEXT NOT NULL,
      secret     TEXT NOT NULL DEFAULT '',
      events     TEXT NOT NULL DEFAULT 'ticket.created,ticket.updated,ticket.resolved,ticket.closed',
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS api_keys (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      key_prefix     TEXT NOT NULL,
      key_hash       TEXT NOT NULL UNIQUE,
      created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_used_at   TIMESTAMPTZ,
      requests_count INTEGER NOT NULL DEFAULT 0,
      rate_limit     INTEGER NOT NULL DEFAULT 100,
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS api_rate_limits (
      key_id        INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      window_start  TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key_id, window_start)
    )`,
    `CREATE TABLE IF NOT EXISTS jira_syncs (
      id             SERIAL PRIMARY KEY,
      ticket_id      INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      jira_issue_key TEXT NOT NULL,
      jira_project   TEXT NOT NULL,
      pushed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_sync_at   TIMESTAMPTZ
    )`,
    // Phase 5 tables
    `CREATE TABLE IF NOT EXISTS satisfaction_ratings (
      id           SERIAL PRIMARY KEY,
      ticket_id    INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      token        TEXT NOT NULL UNIQUE,
      rating       TEXT CHECK(rating IN ('up', 'down')),
      comment      TEXT,
      submitted_at TIMESTAMPTZ,
      sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS monthly_reports (
      id             SERIAL PRIMARY KEY,
      report_month   TEXT NOT NULL UNIQUE,
      report_text    TEXT NOT NULL,
      pdf_path       TEXT,
      stats          TEXT,
      generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    // Phase 6 tables
    `CREATE TABLE IF NOT EXISTS incidents (
      id             SERIAL PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      category       TEXT NOT NULL,
      ticket_id      INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','resolved')),
      resolved_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolved_at    TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type           TEXT NOT NULL,
      title          TEXT NOT NULL,
      body           TEXT NOT NULL,
      link           TEXT,
      is_read        INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS notification_preferences (
      id                    SERIAL PRIMARY KEY,
      user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      ticket_assigned       INTEGER NOT NULL DEFAULT 1,
      ticket_updated        INTEGER NOT NULL DEFAULT 1,
      ticket_resolved       INTEGER NOT NULL DEFAULT 1,
      new_comment           INTEGER NOT NULL DEFAULT 1,
      incident_alert        INTEGER NOT NULL DEFAULT 1,
      weekly_briefing       INTEGER NOT NULL DEFAULT 1,
      digest_enabled        INTEGER NOT NULL DEFAULT 0,
      digest_hour           INTEGER NOT NULL DEFAULT 8,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_templates (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      category       TEXT,
      body           TEXT NOT NULL,
      created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      usage_count    INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_clusters (
      id             SERIAL PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT,
      category       TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
      resolved_at    TIMESTAMPTZ,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_cluster_members (
      cluster_id  INTEGER NOT NULL REFERENCES ticket_clusters(id) ON DELETE CASCADE,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      PRIMARY KEY (cluster_id, ticket_id)
    )`,
    // Phase 7 tables — new features
    `CREATE TABLE IF NOT EXISTS chat_sessions (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id     INTEGER NOT NULL DEFAULT 1,
      status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','converted')),
      ticket_id      INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      taken_over_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      taken_over_at  TIMESTAMPTZ,
      rating         TEXT CHECK(rating IN ('up','down')),
      message_count  INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id         SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS automation_rules (
      id           SERIAL PRIMARY KEY,
      company_id   INTEGER NOT NULL DEFAULT 1,
      name         TEXT NOT NULL,
      description  TEXT,
      trigger_type TEXT NOT NULL,
      trigger_config TEXT NOT NULL DEFAULT '{}',
      condition_logic TEXT NOT NULL DEFAULT 'AND',
      conditions   TEXT NOT NULL DEFAULT '[]',
      actions      TEXT NOT NULL DEFAULT '[]',
      is_enabled   INTEGER NOT NULL DEFAULT 1,
      run_count    INTEGER NOT NULL DEFAULT 0,
      last_run_at  TIMESTAMPTZ,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS automation_logs (
      id           SERIAL PRIMARY KEY,
      rule_id      INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
      company_id   INTEGER NOT NULL DEFAULT 1,
      ticket_id    INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      triggered_by TEXT NOT NULL,
      actions_taken TEXT NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS time_entries (
      id          SERIAL PRIMARY KEY,
      ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      company_id  INTEGER NOT NULL DEFAULT 1,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      started_at  TIMESTAMPTZ,
      ended_at    TIMESTAMPTZ,
      is_running  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ticket_relations (
      id          SERIAL PRIMARY KEY,
      parent_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      child_id    INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      company_id  INTEGER NOT NULL DEFAULT 1,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (parent_id, child_id)
    )`,
    `CREATE TABLE IF NOT EXISTS asset_relations (
      id            SERIAL PRIMARY KEY,
      from_asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      to_asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL DEFAULT 'connected_to',
      company_id    INTEGER NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (from_asset_id, to_asset_id)
    )`,
    `CREATE TABLE IF NOT EXISTS software_licenses (
      id            SERIAL PRIMARY KEY,
      company_id    INTEGER NOT NULL DEFAULT 1,
      software_name TEXT NOT NULL,
      vendor        TEXT,
      license_type  TEXT,
      seats_purchased INTEGER NOT NULL DEFAULT 1,
      seats_used    INTEGER NOT NULL DEFAULT 0,
      cost_per_seat NUMERIC(10,2),
      renewal_date  DATE,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id          SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL DEFAULT 1,
      name        TEXT NOT NULL DEFAULT 'New Session',
      started_by  INTEGER NOT NULL REFERENCES users(id),
      started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes       TEXT
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
  await addColumnIfMissing('atlas_actions', 'provider',     "TEXT DEFAULT 'google'");
  await addColumnIfMissing('integrations',  'metadata',     'TEXT');
  // Phase 3 columns
  await addColumnIfMissing('users',    'totp_secret',       'TEXT');
  await addColumnIfMissing('users',    'totp_enabled',      'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('users',    'sso_provider',      'TEXT');
  await addColumnIfMissing('users',    'sso_id',            'TEXT');
  await addColumnIfMissing('users',    'department_id',     'INTEGER');
  await addColumnIfMissing('tickets',  'sla_due_at',        'TIMESTAMPTZ');
  await addColumnIfMissing('tickets',  'is_escalated',      'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('tickets',  'department_id',     'INTEGER');
  await addColumnIfMissing('tickets',  'custom_fields',     'TEXT');
  // Multi-tenancy columns
  await addColumnIfMissing('users',              'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('tickets',            'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('knowledge_base',     'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('assets',             'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('departments',        'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('incidents',          'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('notifications',      'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('audit_log',          'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('integrations',       'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('webhooks',           'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('api_keys',           'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('ticket_templates',   'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('ticket_clusters',    'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('maintenance_windows','company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('custom_fields',      'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('monthly_reports',    'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('learned_solutions',  'company_id', 'INTEGER NOT NULL DEFAULT 1');
  await addColumnIfMissing('company_profile',    'company_id', 'INTEGER NOT NULL DEFAULT 1');
  // Phase 7 columns
  await addColumnIfMissing('knowledge_base', 'is_public', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('companies', 'support_email', 'TEXT');
  await addColumnIfMissing('companies', 'support_email_slug', 'TEXT');
  await addColumnIfMissing('companies', 'is_sandbox', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing('tickets', 'parent_id', 'INTEGER');
  await addColumnIfMissing('assets', 'purchase_cost', 'NUMERIC(10,2)');
  await addColumnIfMissing('assets', 'depreciation_years', 'INTEGER NOT NULL DEFAULT 5');
  await addColumnIfMissing('assets', 'qr_code', 'TEXT');
  await addColumnIfMissing('assets', 'location', 'TEXT');
  await addColumnIfMissing('satisfaction_ratings', 'star_rating', 'INTEGER');
  await addColumnIfMissing('satisfaction_ratings', 'speed_rating', 'INTEGER');
  await addColumnIfMissing('satisfaction_ratings', 'quality_rating', 'INTEGER');
  await addColumnIfMissing('satisfaction_ratings', 'communication_rating', 'INTEGER');
  await addColumnIfMissing('satisfaction_ratings', 'atlas_rating', 'INTEGER');
  await addColumnIfMissing('satisfaction_ratings', 'nps_score', 'INTEGER');
  await addColumnIfMissing('atlas_actions', 'company_id', 'INTEGER NOT NULL DEFAULT 1');

  // Fix departments UNIQUE: drop global name unique, add per-company unique
  await db.run(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'departments_name_key' AND t.relname = 'departments'
      ) THEN
        ALTER TABLE departments DROP CONSTRAINT departments_name_key;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'departments_company_name_key' AND t.relname = 'departments'
      ) THEN
        ALTER TABLE departments ADD CONSTRAINT departments_company_name_key UNIQUE (company_id, name);
      END IF;
    END $$;
  `);

  // Fix monthly_reports UNIQUE: drop global report_month unique, add per-company unique
  await db.run(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'monthly_reports_report_month_key' AND t.relname = 'monthly_reports'
      ) THEN
        ALTER TABLE monthly_reports DROP CONSTRAINT monthly_reports_report_month_key;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.conname = 'monthly_reports_company_month_key' AND t.relname = 'monthly_reports'
      ) THEN
        ALTER TABLE monthly_reports ADD CONSTRAINT monthly_reports_company_month_key UNIQUE (company_id, report_month);
      END IF;
    END $$;
  `);

  // Settings: add company_id column, change PK to (company_id, key)
  await db.run(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_id INTEGER NOT NULL DEFAULT 1`);
  await db.run(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'settings_company_key_pkey'
      ) THEN
        ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
        ALTER TABLE settings ADD CONSTRAINT settings_company_key_pkey PRIMARY KEY (company_id, key);
      END IF;
    END $$;
  `);

  // Ensure default company exists
  await db.run(`
    INSERT INTO companies (id, name, slug) VALUES (1, 'Sentinel IT', 'sentinel-it')
    ON CONFLICT (id) DO NOTHING
  `);
  // Fix sequence after manual id insert
  await db.run(`SELECT setval('companies_id_seq', GREATEST(1, (SELECT MAX(id) FROM companies)))`);

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
    // Phase 4 settings
    ['slack_webhook_url',         ''],
    ['slack_channel',             ''],
    ['slack_enabled',             'false'],
    ['email_ingestion_enabled',   'false'],
    ['imap_host',                 ''],
    ['imap_user',                 ''],
    ['imap_pass',                 ''],
    ['imap_port',                 '993'],
    ['pagerduty_routing_key',     ''],
    ['pagerduty_enabled',         'false'],
    ['jira_host',                 ''],
    ['jira_email',                ''],
    ['jira_token',                ''],
    ['jira_project',              ''],
    ['jira_enabled',              'false'],
    // Phase 6 settings
    ['atlas_custom_instructions', ''],
    ['weekly_briefing_enabled',   'true'],
    ['health_score_alert_threshold', '70'],
    // Billing settings (existing deployments start as active)
    ['subscription_plan',   'active'],
    ['subscription_status', 'active'],
    ['trial_ends_at',       ''],
    ['stripe_customer_id',  ''],
    ['stripe_subscription_id', ''],
    ['billing_period_end',  ''],
  ];
  for (const [key, value] of settingSeeds) {
    await db.run(
      'INSERT INTO settings (company_id, key, value) VALUES (1, ?, ?) ON CONFLICT (company_id, key) DO NOTHING',
      key, value
    );
  }

  // Seed default role permissions
  const defaultPermissions = [
    // admin gets everything
    ['admin', 'close_tickets'],
    ['admin', 'see_internal_notes'],
    ['admin', 'access_kb'],
    ['admin', 'export_data'],
    ['admin', 'manage_users'],
    ['admin', 'manage_assets'],
    ['admin', 'view_audit_log'],
    ['admin', 'manage_departments'],
    ['admin', 'manage_custom_fields'],
    ['admin', 'manage_permissions'],
    // it_staff
    ['it_staff', 'close_tickets'],
    ['it_staff', 'see_internal_notes'],
    ['it_staff', 'access_kb'],
    ['it_staff', 'manage_assets'],
    // employee
    ['employee', 'access_kb'],
  ];
  for (const [role, permission_key] of defaultPermissions) {
    await db.run(
      'INSERT INTO role_permissions (role, permission_key) VALUES (?, ?) ON CONFLICT DO NOTHING',
      role, permission_key
    );
  }

  // Always ensure the default admin exists with the correct credentials.
  // ON CONFLICT means this is safe to run on every startup — it won't
  // overwrite a manually-changed password for any *other* account.
  const adminHash = bcrypt.hashSync('420699202005', 10);
  await db.run(
    `INSERT INTO users (name, email, password, role, is_active, company_id)
     VALUES (?, ?, ?, ?, 1, 1)
     ON CONFLICT (email) DO UPDATE
       SET password   = EXCLUDED.password,
           role       = EXCLUDED.role,
           is_active  = 1,
           company_id = 1`,
    'Admin User', 'iguinn141@gmail.com', adminHash, 'admin'
  );
  console.log('✓ Admin account ensured: iguinn141@gmail.com');
}
