/**
 * build-sqlite.mjs
 *
 * One-time script that converts the Postgres census database into a lean
 * SQLite file bundled with the MCP server.  Only the columns actually
 * queried by the server tools are exported; cache / migration tables are
 * dropped entirely.
 *
 * Usage (from mcp-server/):
 *   node scripts/build-sqlite.mjs
 *
 * Environment variable (optional):
 *   DATABASE_URL  – Postgres connection string
 *                   (default: postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db)
 */

import pg from 'pg'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import path from 'path'
import { mkdirSync } from 'fs'

const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, '../data/census.db')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db'

async function build() {
  console.log('Connecting to Postgres:', DATABASE_URL.replace(/:[^:@]*@/, ':***@'))
  const pool = new Pool({ connectionString: DATABASE_URL })
  const client = await pool.connect()

  mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new Database(DB_PATH)

  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')

  try {
    console.log('\nCreating SQLite schema...')
    db.exec(`
      DROP TABLE IF EXISTS data_table_datasets;
      DROP TABLE IF EXISTS data_tables;
      DROP TABLE IF EXISTS dataset_topics;
      DROP TABLE IF EXISTS datasets;
      DROP TABLE IF EXISTS years;
      DROP TABLE IF EXISTS geographies;
      DROP TABLE IF EXISTS summary_levels;

      CREATE TABLE summary_levels (
        id                     INTEGER PRIMARY KEY,
        code                   TEXT    NOT NULL UNIQUE,
        name                   TEXT    NOT NULL,
        description            TEXT,
        get_variable           TEXT    NOT NULL DEFAULT '',
        query_name             TEXT    NOT NULL DEFAULT '',
        on_spine               INTEGER NOT NULL DEFAULT 0,
        parent_summary_level   TEXT,
        parent_summary_level_id INTEGER,
        hierarchy_level        INTEGER DEFAULT 99
      );

      CREATE TABLE geographies (
        id                  INTEGER PRIMARY KEY,
        name                TEXT    NOT NULL,
        summary_level_code  TEXT,
        latitude            REAL,
        longitude           REAL,
        for_param           TEXT    NOT NULL,
        in_param            TEXT
      );

      CREATE TABLE years (
        id   INTEGER PRIMARY KEY,
        year INTEGER NOT NULL UNIQUE
      );

      CREATE TABLE datasets (
        id            INTEGER PRIMARY KEY,
        dataset_id    TEXT NOT NULL UNIQUE,
        dataset_param TEXT NOT NULL,
        year_id       INTEGER
      );

      CREATE TABLE data_tables (
        id            INTEGER PRIMARY KEY,
        data_table_id TEXT NOT NULL UNIQUE,
        label         TEXT NOT NULL
      );

      CREATE TABLE data_table_datasets (
        id            INTEGER PRIMARY KEY,
        dataset_id    INTEGER NOT NULL,
        data_table_id INTEGER NOT NULL,
        label         TEXT    NOT NULL,
        UNIQUE(dataset_id, data_table_id)
      );
    `)

    // ── summary_levels ──────────────────────────────────────────────────────
    console.log('Importing summary_levels...')
    const slRows = (
      await client.query(
        'SELECT id, code, name, description, get_variable, query_name, on_spine, parent_summary_level, parent_summary_level_id, hierarchy_level FROM summary_levels',
      )
    ).rows
    const insertSL = db.prepare(`
      INSERT OR IGNORE INTO summary_levels
        (id, code, name, description, get_variable, query_name, on_spine,
         parent_summary_level, parent_summary_level_id, hierarchy_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    db.transaction(() => {
      for (const r of slRows) {
        insertSL.run(
          r.id, r.code, r.name, r.description ?? null, r.get_variable ?? '',
          r.query_name ?? '', r.on_spine ? 1 : 0,
          r.parent_summary_level ?? null, r.parent_summary_level_id ?? null,
          r.hierarchy_level ?? 99,
        )
      }
    })()
    console.log(`  ${slRows.length} rows`)

    // ── geographies ─────────────────────────────────────────────────────────
    console.log('Importing geographies (only needed columns)...')
    const geoRows = (
      await client.query(
        'SELECT id, name, summary_level_code, latitude, longitude, for_param, in_param FROM geographies',
      )
    ).rows
    const insertGeo = db.prepare(`
      INSERT OR IGNORE INTO geographies
        (id, name, summary_level_code, latitude, longitude, for_param, in_param)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    db.transaction(() => {
      for (const r of geoRows) {
        insertGeo.run(r.id, r.name, r.summary_level_code, r.latitude, r.longitude, r.for_param, r.in_param)
      }
    })()
    console.log(`  ${geoRows.length} rows`)

    // ── years ────────────────────────────────────────────────────────────────
    console.log('Importing years...')
    const yearRows = (await client.query('SELECT id, year FROM years')).rows
    const insertYear = db.prepare('INSERT OR IGNORE INTO years (id, year) VALUES (?, ?)')
    db.transaction(() => {
      for (const r of yearRows) insertYear.run(r.id, r.year)
    })()
    console.log(`  ${yearRows.length} rows`)

    // ── datasets ─────────────────────────────────────────────────────────────
    console.log('Importing datasets...')
    const dsRows = (
      await client.query('SELECT id, dataset_id, dataset_param, year_id FROM datasets')
    ).rows
    const insertDS = db.prepare(
      'INSERT OR IGNORE INTO datasets (id, dataset_id, dataset_param, year_id) VALUES (?, ?, ?, ?)',
    )
    db.transaction(() => {
      for (const r of dsRows) insertDS.run(r.id, r.dataset_id, r.dataset_param, r.year_id ?? null)
    })()
    console.log(`  ${dsRows.length} rows`)

    // ── data_tables ──────────────────────────────────────────────────────────
    console.log('Importing data_tables...')
    const dtRows = (
      await client.query('SELECT id, data_table_id, label FROM data_tables')
    ).rows
    const insertDT = db.prepare(
      'INSERT OR IGNORE INTO data_tables (id, data_table_id, label) VALUES (?, ?, ?)',
    )
    db.transaction(() => {
      for (const r of dtRows) insertDT.run(r.id, r.data_table_id, r.label)
    })()
    console.log(`  ${dtRows.length} rows`)

    // ── data_table_datasets ──────────────────────────────────────────────────
    console.log('Importing data_table_datasets...')
    const dtdRows = (
      await client.query('SELECT id, dataset_id, data_table_id, label FROM data_table_datasets')
    ).rows
    const insertDTD = db.prepare(`
      INSERT OR IGNORE INTO data_table_datasets (id, dataset_id, data_table_id, label)
      VALUES (?, ?, ?, ?)
    `)
    db.transaction(() => {
      for (const r of dtdRows) insertDTD.run(r.id, r.dataset_id, r.data_table_id, r.label)
    })()
    console.log(`  ${dtdRows.length} rows`)

    // ── indexes ──────────────────────────────────────────────────────────────
    console.log('Creating indexes...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_geo_summary_level ON geographies(summary_level_code);
      CREATE INDEX IF NOT EXISTS idx_geo_name          ON geographies(name);
      CREATE INDEX IF NOT EXISTS idx_dtd_data_table    ON data_table_datasets(data_table_id);
      CREATE INDEX IF NOT EXISTS idx_dtd_dataset       ON data_table_datasets(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_ds_year_id        ON datasets(year_id);
    `)

    // ── VACUUM to compact ────────────────────────────────────────────────────
    console.log('Vacuuming...')
    db.exec('VACUUM')

    const stat = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get()
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1)
    console.log(`\nDone! SQLite database written to: ${DB_PATH} (${sizeMB} MB)`)

  } finally {
    client.release()
    await pool.end()
    db.close()
  }
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
