import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool, types } = pg;

// Parse bigint (OID 20) as JS number — fixes COUNT(*) returning string
types.setTypeParser(20, val => parseInt(val, 10));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const txStore = new AsyncLocalStorage();

function toPositional(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function getConn() {
  return txStore.getStore() ?? pool;
}

async function get(sql, ...params) {
  const res = await getConn().query(toPositional(sql), params);
  return res.rows[0] ?? null;
}

async function all(sql, ...params) {
  const res = await getConn().query(toPositional(sql), params);
  return res.rows;
}

async function run(sql, ...params) {
  const trimmed = sql.trimStart();
  const converted = toPositional(trimmed);
  const isInsert = /^INSERT\s/i.test(trimmed);
  const hasReturning = /\bRETURNING\b/i.test(trimmed);

  if (isInsert && !hasReturning) {
    try {
      const res = await getConn().query(`${converted} RETURNING id`, params);
      return { lastInsertRowid: res.rows[0]?.id ?? null, changes: res.rowCount ?? 0 };
    } catch (e) {
      if (e.message?.includes('column "id" does not exist')) {
        const res = await getConn().query(converted, params);
        return { lastInsertRowid: null, changes: res.rowCount ?? 0 };
      }
      throw e;
    }
  }

  const res = await getConn().query(converted, params);
  return { lastInsertRowid: res.rows[0]?.id ?? null, changes: res.rowCount ?? 0 };
}

async function exec(sql) {
  const client = await pool.connect();
  try {
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await client.query(stmt);
    }
  } finally {
    client.release();
  }
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await txStore.run(client, fn);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default { get, all, run, exec, transaction };
