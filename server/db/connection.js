import sqlite3Pkg from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Database } = sqlite3Pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const rawDb = new Database(join(__dirname, '../data/sentinel.db'));

rawDb.run('PRAGMA journal_mode = WAL');
rawDb.run('PRAGMA foreign_keys = ON');

function get(sql, ...params) {
  return new Promise((resolve, reject) => {
    rawDb.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

function all(sql, ...params) {
  return new Promise((resolve, reject) => {
    rawDb.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function run(sql, ...params) {
  return new Promise((resolve, reject) => {
    rawDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    rawDb.exec(sql, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

async function transaction(fn) {
  await run('BEGIN');
  try {
    await fn();
    await run('COMMIT');
  } catch (e) {
    await run('ROLLBACK');
    throw e;
  }
}

export default { get, all, run, exec, transaction };
