/**
 * reset-admin.js
 * Deletes all users and re-runs migrations so the default admin is reseeded.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node server/scripts/reset-admin.js
 */

import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    console.error('Usage: DATABASE_URL="postgresql://..." node server/scripts/reset-admin.js');
    process.exit(1);
  }

  console.log('Connecting to database…');
  const client = await pool.connect();

  try {
    // Check current user count
    const before = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`Current users in DB: ${before.rows[0].count}`);

    // Delete all users
    const del = await client.query('DELETE FROM users');
    console.log(`Deleted ${del.rowCount} user(s).`);

    // Reseed admin
    const hash = bcrypt.hashSync('420699202005', 10);
    await client.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      ['Admin User', 'iguinn141@gmail.com', hash, 'admin']
    );
    console.log('✓ Admin reseeded: iguinn141@gmail.com / 420699202005');

    // Verify
    const after = await client.query("SELECT id, name, email, role FROM users WHERE email = 'iguinn141@gmail.com'");
    console.log('✓ Verified:', after.rows[0]);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => {
  console.error('Script failed:', e.message);
  process.exit(1);
});
