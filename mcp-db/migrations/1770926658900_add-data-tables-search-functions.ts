import { MigrationBuilder } from 'node-pg-migrate'

export const indexDataTableLabelSQL = `
  CREATE INDEX idx_data_tables_label_trgm
  ON data_tables USING gin (label gin_trgm_ops)
`

export const indexDataTableDatasetsLabelSQL = `
  CREATE INDEX idx_dtd_label_trgm
  ON data_table_datasets USING gin (label gin_trgm_ops)
`

export const searchDataTablesSQL = `
  CREATE OR REPLACE FUNCTION search_data_tables(
    p_data_table_id  TEXT    DEFAULT NULL,
    p_label_query    TEXT    DEFAULT NULL,
    p_dataset_id     TEXT    DEFAULT NULL,
    p_limit          INTEGER DEFAULT 20
  )
  RETURNS TABLE (
    data_table_id  TEXT,
    label          TEXT,
    datasets       JSONB
  )
  LANGUAGE sql STABLE
  AS $$
    SELECT
      dt.data_table_id,
      dt.label,

      -- Datasets array: include dataset-specific label only when it differs
      -- from the canonical label (trimmed, case-insensitive comparison)
      jsonb_agg(
        CASE
          WHEN LOWER(TRIM(dtd.label)) <> LOWER(TRIM(dt.label))
          THEN jsonb_build_object(
            'dataset_id', d.dataset_id,
            'year',       y.year,
            'label',      dtd.label
          )
          ELSE jsonb_build_object(
            'dataset_id', d.dataset_id,
            'year',       y.year
          )
        END
        ORDER BY y.year
      ) AS datasets

    FROM data_tables dt
    JOIN data_table_datasets dtd ON dtd.data_table_id = dt.id
    JOIN datasets             d   ON d.id = dtd.dataset_id
    LEFT JOIN years           y   ON y.id = d.year_id

    WHERE
      -- Exact match or prefix match on data_table_id
      (
        p_data_table_id IS NULL
        OR dt.data_table_id = p_data_table_id
        OR dt.data_table_id ILIKE (p_data_table_id || '%')
      )

      -- Filter by dataset string identifier (e.g. 'ACSDTY2009')
      AND (
        p_dataset_id IS NULL
        OR d.dataset_id = p_dataset_id
      )

      -- Label search: when scoped to a dataset, search the variant label;
      -- otherwise search the canonical label on data_tables
      AND (
        p_label_query IS NULL
        OR (
          p_dataset_id IS NULL
          AND dt.label % p_label_query
        )
        OR (
          p_dataset_id IS NOT NULL
          AND dtd.label % p_label_query
        )
      )

    GROUP BY dt.id, dt.data_table_id, dt.label

    -- When a label query is present and dataset scope is not specified, rank by full-text relevance;
    -- otherwise fall back to alphabetical data_table_id order
    ORDER BY
      CASE
        WHEN p_label_query IS NOT NULL AND p_dataset_id IS NULL
          THEN SIMILARITY(dt.label, p_label_query)
        WHEN p_label_query IS NOT NULL AND p_dataset_id IS NOT NULL
          THEN MAX(SIMILARITY(dtd.label, p_label_query))
        ELSE 0
      END DESC,
      dt.data_table_id ASC

    LIMIT p_limit;
  $$;
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(indexDataTableLabelSQL)

  pgm.sql(indexDataTableDatasetsLabelSQL)

  pgm.createIndex('data_table_datasets', 'dataset_id', {
    name: 'idx_dtd_dataset_id',
  })

  pgm.sql(searchDataTablesSQL)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS search_data_tables')
  pgm.sql('DROP INDEX IF EXISTS idx_dtd_dataset_id')
  pgm.sql('DROP INDEX IF EXISTS idx_dtd_label_trgm')
  pgm.sql('DROP INDEX IF EXISTS idx_data_tables_label_trgm')
}
