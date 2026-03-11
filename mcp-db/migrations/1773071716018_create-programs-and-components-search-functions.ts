import { MigrationBuilder } from 'node-pg-migrate'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface CsvRow {
  PROGRAM_STRING: string
  PROGRAM_DESCRIPTION: string
  COMPONENT_STRING: string
  FREQUENCY: string
  FREQUENCY_NOTES: string
}

const csvPath = path.resolve(__dirname, '../data/components-programs.csv')
const csvData = parse(readFileSync(csvPath, 'utf8'), {
  columns: true,
  skip_empty_lines: true,
})

const escapeSql = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value.trim() === '')
    return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}
const programMap = new Map<string, string>()
for (const row of csvData as CsvRow[]) {
  const acronym = row.PROGRAM_STRING?.trim()
  if (!acronym) continue
  const description = row.PROGRAM_DESCRIPTION?.trim()
  if (!programMap.has(acronym)) {
    programMap.set(acronym, description ?? '')
  }
}

const programValues = Array.from(programMap.entries())
  .map(
    ([acronym, description]) =>
      `(${escapeSql(acronym)}, ${escapeSql(description)})`,
  )
  .join(',\n        ')

const componentValues = (csvData as CsvRow[])
  .map(
    (row) =>
      `(${escapeSql(row.COMPONENT_STRING)}, ${escapeSql(row.FREQUENCY)}, ${escapeSql(row.FREQUENCY_NOTES)})`,
  )
  .join(',\n        ')

export const listSurveyProgramsSQL = `
  CREATE OR REPLACE FUNCTION list_survey_programs()
  RETURNS TABLE (
    program_label  TEXT,
    program_string VARCHAR(15),
    description    TEXT,
    table_count    INT,
    searchable     BOOLEAN
  )
  LANGUAGE sql STABLE
  AS $$
    SELECT
      p.label                                                    AS program_label,
      p.acronym                                                  AS program_string,
      -- Prefer the explicit program description; fall back to the first
      -- non-null component description so that programs without a
      -- programs.description still get orientation text.
      COALESCE(
        NULLIF(TRIM(p.description), ''),
        (
          SELECT c2.description
          FROM   components c2
          WHERE  c2.program_id = p.id
            AND  c2.description IS NOT NULL
          ORDER  BY c2.id
          LIMIT  1
        )
      )                                                          AS description,
      COUNT(DISTINCT dt.id)::INT                                 AS table_count,
      COUNT(DISTINCT dt.id) > 0                                  AS searchable
    FROM  programs p
    LEFT  JOIN components          c   ON c.program_id   = p.id
    LEFT  JOIN datasets            d   ON d.component_id = c.id
    LEFT  JOIN data_table_datasets dtd ON dtd.dataset_id = d.id
    LEFT  JOIN data_tables         dt  ON dt.id = dtd.data_table_id
    GROUP BY p.id, p.label, p.acronym, p.description
    ORDER BY p.label
  $$;
`

export const listSurveyComponentsSQL = `
  CREATE OR REPLACE FUNCTION list_survey_components(p_program_string TEXT)
  RETURNS TABLE (
    component_label  TEXT,
    component_string VARCHAR(60),
    api_endpoint     VARCHAR(60),
    frequency        VARCHAR(50),
    frequency_notes  TEXT,
    vintage_start    INT,
    vintage_end      INT,
    has_gaps         BOOLEAN,
    table_count      INT,
    description      TEXT
  )
  LANGUAGE sql STABLE
  AS $$
    SELECT
      c.label                                                        AS component_label,
      c.component_id                                                 AS component_string,
      c.api_endpoint,
      c.frequency,
      c.frequency_notes,
      MIN(y.year)::INT                                               AS vintage_start,
      MAX(y.year)::INT                                               AS vintage_end,
      -- has_gaps: true when the year range is not fully contiguous.
      -- NULL when no datasets are linked (nothing to compare).
      CASE
        WHEN COUNT(DISTINCT y.year) = 0 THEN NULL
        ELSE (MAX(y.year) - MIN(y.year) + 1) != COUNT(DISTINCT y.year)
      END                                                            AS has_gaps,
      COUNT(DISTINCT dt.id)::INT                                     AS table_count,
      c.description
    FROM   programs p
    JOIN   components          c   ON c.program_id   = p.id
    LEFT   JOIN datasets       d   ON d.component_id = c.id
    LEFT   JOIN years          y   ON y.id = d.year_id
    LEFT   JOIN data_table_datasets dtd ON dtd.dataset_id = d.id
    LEFT   JOIN data_tables    dt  ON dt.id = dtd.data_table_id
    WHERE  p.acronym = p_program_string
    GROUP  BY c.id, c.label, c.component_id, c.api_endpoint,
              c.frequency, c.frequency_notes, c.description
    ORDER  BY c.label
  $$;
`
export const updateProgramComponentColumns = `
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM programs LIMIT 1) AND EXISTS (SELECT 1 FROM components LIMIT 1) THEN

      UPDATE programs SET description = v.description
      FROM (VALUES
        ${programValues}
      ) AS v(acronym, description)
      WHERE programs.acronym = v.acronym;

      UPDATE components SET
        frequency = v.frequency,
        frequency_notes = v.frequency_notes
      FROM (VALUES
        ${componentValues}
      ) AS v(component_id, frequency, frequency_notes)
      WHERE components.component_id = v.component_id;

    ELSE
      RAISE NOTICE 'programs or components table is empty, skipping backfill for frequency and description columns.';
    END IF;
  END $$;
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('components', {
    frequency: { type: 'varchar(50)' },
    frequency_notes: { type: 'text' },
  })

  pgm.sql(updateProgramComponentColumns)
  pgm.sql(listSurveyProgramsSQL)
  pgm.sql(listSurveyComponentsSQL)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS list_survey_components(TEXT)')
  pgm.sql('DROP FUNCTION IF EXISTS list_survey_programs()')
  pgm.dropColumns('components', ['frequency', 'frequency_notes'])
  pgm.sql('UPDATE programs SET description = NULL;')
}
