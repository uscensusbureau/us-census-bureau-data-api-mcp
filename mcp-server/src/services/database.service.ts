import { fileURLToPath } from 'url'
import path from 'path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import type { GeographySearchResultRow } from '../types/geography.types.js'
import type { SummaryLevelRow } from '../types/summary-level.types.js'
import type { DataTableSearchResultRow, DataTableDatasetEntry } from '../types/data-table.types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Trigram similarity – drop-in replacement for PostgreSQL's pg_trgm similarity()
// Returns a value in [0, 1] where 1 = identical strings.
// ---------------------------------------------------------------------------
function trigramSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  const s1 = a.toLowerCase()
  const s2 = b.toLowerCase()
  if (s1 === s2) return 1
  if (s1.length < 2 || s2.length < 2) return 0

  const t1 = new Set<string>()
  const t2 = new Set<string>()
  for (let i = 0; i <= s1.length - 3; i++) t1.add(s1.slice(i, i + 3))
  for (let i = 0; i <= s2.length - 3; i++) t2.add(s2.slice(i, i + 3))

  let intersection = 0
  for (const tg of t1) if (t2.has(tg)) intersection++

  return (2.0 * intersection) / (t1.size + t2.size)
}

// ---------------------------------------------------------------------------
// Internal row shapes returned by SQLite
// ---------------------------------------------------------------------------
interface SummaryLevelCodeRow {
  code: string
  name: string
}

interface GeoRow {
  id: number
  name: string
  summary_level_name: string | null
  latitude: number | null
  longitude: number | null
  for_param: string
  in_param: string | null
  weighted_score: number
}

interface SummaryLevelDbRow {
  id: number
  code: string
  name: string
  description: string | null
  get_variable: string
  query_name: string
  on_spine: number        // SQLite stores booleans as 0/1
  parent_summary_level: string | null
  parent_summary_level_id: number | null
  hierarchy_level: number
}

interface DataTableRow {
  id: number
  data_table_id: string
  label: string
}

interface DatasetJoinRow {
  dataset_id: string
  dataset_param: string
  year: number | null
  dtd_label: string
  dt_label: string
}

interface SearchDataTablesArgs {
  data_table_id?: string | null
  label_query?: string | null
  dataset_id?: string | null
  limit?: number | null
}

// ---------------------------------------------------------------------------
// DatabaseService
// ---------------------------------------------------------------------------
export class DatabaseService {
  private static instance: DatabaseService
  private db: DatabaseType

  private constructor() {
    const dbPath = path.join(__dirname, '../../data/census.db')
    this.db = new Database(dbPath, { readonly: true })
    this.db.pragma('journal_mode = WAL')

    // Register JS trigram similarity as a SQLite scalar function
    this.db.function('similarity', (a: unknown, b: unknown) =>
      trigramSimilarity(a as string | null, b as string | null),
    )
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  // ── Health check ──────────────────────────────────────────────────────────
  public healthCheck(): boolean {
    try {
      this.db.prepare('SELECT 1').get()
      return true
    } catch {
      return false
    }
  }

  // ── Summary levels ────────────────────────────────────────────────────────

  public getSummaryLevels(): SummaryLevelRow[] {
    const rows = this.db
      .prepare(
        `SELECT id, code, name, description, get_variable, query_name, on_spine,
                parent_summary_level, parent_summary_level_id
         FROM summary_levels
         ORDER BY code`,
      )
      .all() as SummaryLevelDbRow[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      get_variable: r.get_variable,
      query_name: r.query_name,
      on_spine: r.on_spine === 1,
      code: r.code,
      summary_level: r.code,
      parent_summary_level: r.parent_summary_level,
      parent_geography_level_id: r.parent_summary_level_id,
      created_at: new Date(0),
      updated_at: new Date(0),
    }))
  }

  // ── Summary level search ──────────────────────────────────────────────────

  public searchSummaryLevels(searchTerm: string, limit = 1): SummaryLevelCodeRow[] {
    // Zero-pad numeric codes to 3 chars (mirrors Postgres LPAD($1, 3, '0'))
    const paddedCode = /^\d+$/.test(searchTerm)
      ? searchTerm.padStart(3, '0')
      : searchTerm
    const lower = searchTerm.toLowerCase().trim()

    return this.db
      .prepare(
        `SELECT code, name
         FROM summary_levels
         WHERE code = ?
            OR LOWER(name) = ?
            OR similarity(LOWER(name), ?) > 0.3
         ORDER BY
           CASE
             WHEN code = ?        THEN 1.0
             WHEN LOWER(name) = ? THEN 1.0
             ELSE similarity(LOWER(name), ?)
           END DESC,
           CASE
             WHEN code = ?        THEN 1
             WHEN LOWER(name) = ? THEN 2
             ELSE 3
           END
         LIMIT ?`,
      )
      .all(paddedCode, lower, lower, paddedCode, lower, lower, paddedCode, lower, limit) as SummaryLevelCodeRow[]
  }

  // ── Geography searches ────────────────────────────────────────────────────

  public searchGeographies(searchTerm: string, limit = 10): GeographySearchResultRow[] {
    const rows = this.db
      .prepare(
        `SELECT
           g.id,
           g.name,
           COALESCE(sl.name, '') AS summary_level_name,
           g.latitude,
           g.longitude,
           g.for_param,
           g.in_param,
           (similarity(g.name, ?) + (1.0 - CAST(COALESCE(sl.hierarchy_level, 99) AS REAL) / 100.0))
             AS weighted_score
         FROM geographies g
         LEFT JOIN summary_levels sl ON g.summary_level_code = sl.code
         WHERE similarity(g.name, ?) > 0.3
            OR g.name LIKE '%' || ? || '%'
         ORDER BY weighted_score DESC, LENGTH(g.name) ASC, g.name ASC
         LIMIT ?`,
      )
      .all(searchTerm, searchTerm, searchTerm, limit) as GeoRow[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      summary_level_name: r.summary_level_name ?? '',
      latitude: r.latitude ?? 0,
      longitude: r.longitude ?? 0,
      for_param: r.for_param,
      in_param: r.in_param ?? '',
      weighted_score: r.weighted_score,
    }))
  }

  public searchGeographiesBySummaryLevel(
    searchTerm: string,
    summaryLevelCode: string,
    limit = 10,
  ): GeographySearchResultRow[] {
    const rows = this.db
      .prepare(
        `SELECT
           g.id,
           g.name,
           COALESCE(sl.name, '') AS summary_level_name,
           g.latitude,
           g.longitude,
           g.for_param,
           g.in_param,
           similarity(g.name, ?) AS weighted_score
         FROM geographies g
         LEFT JOIN summary_levels sl ON g.summary_level_code = sl.code
         WHERE g.summary_level_code = ?
           AND (
             similarity(g.name, ?) > 0.3
             OR g.name LIKE '%' || ? || '%'
           )
         ORDER BY weighted_score DESC, LENGTH(g.name) ASC, g.name ASC
         LIMIT ?`,
      )
      .all(searchTerm, summaryLevelCode, searchTerm, searchTerm, limit) as GeoRow[]

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      summary_level_name: r.summary_level_name ?? '',
      latitude: r.latitude ?? 0,
      longitude: r.longitude ?? 0,
      for_param: r.for_param,
      in_param: r.in_param ?? '',
      weighted_score: r.weighted_score,
    }))
  }

  // ── Data table search ─────────────────────────────────────────────────────

  public searchDataTables(args: SearchDataTablesArgs): DataTableSearchResultRow[] {
    const { data_table_id = null, label_query = null, dataset_id = null, limit = 20 } = args
    const cap = limit ?? 20

    let matchingTables: DataTableRow[]

    if (dataset_id) {
      // When scoped to a specific dataset, filter on variant label (dtd.label)
      const conditions: string[] = ['d.dataset_id = ?']
      const params: unknown[] = [dataset_id]

      if (data_table_id) {
        conditions.push('(dt.data_table_id = ? OR dt.data_table_id LIKE ?)')
        params.push(data_table_id, data_table_id + '%')
      }
      if (label_query) {
        conditions.push('(similarity(dtd.label, ?) > 0.3 OR dtd.label LIKE ?)')
        params.push(label_query, '%' + label_query + '%')
      }

      let orderBy = 'dt.data_table_id ASC'
      if (label_query) {
        orderBy = 'similarity(dtd.label, ?) DESC, dt.data_table_id ASC'
        params.push(label_query)
      }
      params.push(cap)

      matchingTables = this.db
        .prepare(
          `SELECT DISTINCT dt.id, dt.data_table_id, dt.label
           FROM data_tables dt
           JOIN data_table_datasets dtd ON dtd.data_table_id = dt.id
           JOIN datasets d ON d.id = dtd.dataset_id
           WHERE ${conditions.join(' AND ')}
           ORDER BY ${orderBy}
           LIMIT ?`,
        )
        .all(...params) as DataTableRow[]
    } else {
      // Search canonical label
      const conditions: string[] = []
      const params: unknown[] = []

      if (data_table_id) {
        conditions.push('(data_table_id = ? OR data_table_id LIKE ?)')
        params.push(data_table_id, data_table_id + '%')
      }
      if (label_query) {
        conditions.push('(similarity(label, ?) > 0.3 OR label LIKE ?)')
        params.push(label_query, '%' + label_query + '%')
      }

      const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
      const orderParams: unknown[] = []
      let orderBy = 'data_table_id ASC'
      if (label_query) {
        orderBy = 'similarity(label, ?) DESC, data_table_id ASC'
        orderParams.push(label_query)
      }

      matchingTables = this.db
        .prepare(
          `SELECT id, data_table_id, label
           FROM data_tables
           ${where}
           ORDER BY ${orderBy}
           LIMIT ?`,
        )
        .all(...params, ...orderParams, cap) as DataTableRow[]
    }

    if (matchingTables.length === 0) return []

    const datasetsStmt = this.db.prepare(
      `SELECT
         d.dataset_id,
         d.dataset_param,
         y.year,
         dtd.label  AS dtd_label,
         dt.label   AS dt_label
       FROM data_table_datasets dtd
       JOIN datasets    d  ON d.id  = dtd.dataset_id
       LEFT JOIN years  y  ON y.id  = d.year_id
       JOIN data_tables dt ON dt.id = dtd.data_table_id
       WHERE dtd.data_table_id = ?
       ORDER BY y.year ASC`,
    )

    return matchingTables.map((table) => {
      const datasetRows = datasetsStmt.all(table.id) as DatasetJoinRow[]

      const datasets: DataTableDatasetEntry[] = datasetRows.map((row) => {
        const entry: DataTableDatasetEntry = {
          dataset_id: row.dataset_id,
          dataset_param: row.dataset_param,
          year: row.year,
        }
        if (row.dtd_label.toLowerCase().trim() !== row.dt_label.toLowerCase().trim()) {
          entry.label = row.dtd_label
        }
        return entry
      })

      return { data_table_id: table.data_table_id, label: table.label, datasets }
    })
  }
}
