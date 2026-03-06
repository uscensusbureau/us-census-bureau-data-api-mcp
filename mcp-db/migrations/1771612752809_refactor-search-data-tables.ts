import { MigrationBuilder } from 'node-pg-migrate'

import { searchDataTablesSQL } from './1770926658900_add-data-tables-search-functions.js'

export const updatesSearchDataTablesSQL = `
  DROP FUNCTION IF EXISTS search_data_tables(TEXT, TEXT, TEXT, INTEGER);
  CREATE OR REPLACE FUNCTION search_data_tables(
    p_data_table_id  TEXT    DEFAULT NULL,
    p_label_query    TEXT    DEFAULT NULL,
    p_api_endpoint   TEXT    DEFAULT NULL,
    p_limit          INTEGER DEFAULT 20
  )
  RETURNS TABLE (
    data_table_id  TEXT,
    label          TEXT,
    component      TEXT,
    datasets       JSONB
  )
  LANGUAGE sql STABLE
  AS $$
    WITH dataset_years AS (
      SELECT
        dtd.data_table_id                                        AS dt_id,
        COALESCE(d.component_id::TEXT, d.api_endpoint)          AS group_key,
        y.year::TEXT                                             AS year,
        jsonb_agg(d.api_endpoint ORDER BY d.api_endpoint)       AS endpoints
      FROM data_table_datasets dtd
      JOIN datasets   d ON d.id = dtd.dataset_id
      LEFT JOIN years y ON y.id = d.year_id
      WHERE y.year IS NOT NULL
      GROUP BY dtd.data_table_id, group_key, y.year
    ),
    dataset_map AS (
      SELECT
        dt_id,
        group_key,
        jsonb_object_agg(year, endpoints) AS datasets
      FROM dataset_years
      GROUP BY dt_id, group_key
    )
    SELECT
      dt.data_table_id,
      dt.label,
      COALESCE(
        p.label || ' - ' || c.label,
        dm.group_key
      ) AS component,
      dm.datasets

    FROM data_tables dt
    JOIN data_table_datasets dtd ON dtd.data_table_id = dt.id
    JOIN datasets             d   ON d.id = dtd.dataset_id
    JOIN dataset_map          dm  ON dm.dt_id = dt.id
                                  AND dm.group_key = COALESCE(d.component_id::TEXT, d.api_endpoint)
    LEFT JOIN components      c   ON c.id = d.component_id
    LEFT JOIN programs        p   ON p.id = c.program_id
    LEFT JOIN years           y   ON y.id = d.year_id

    WHERE
      (
        p_data_table_id IS NULL
        OR dt.data_table_id = p_data_table_id
        OR dt.data_table_id ILIKE (p_data_table_id || '%')
      )
      AND (
        p_api_endpoint IS NULL
        OR c.api_endpoint = p_api_endpoint
        OR c.api_endpoint LIKE (p_api_endpoint || '/%')
        OR p_api_endpoint LIKE (c.api_endpoint || '/%')
        OR (c.id IS NULL AND (
          d.api_endpoint = p_api_endpoint
          OR d.api_endpoint LIKE (p_api_endpoint || '/%')
          OR p_api_endpoint LIKE (d.api_endpoint || '/%')
        ))
      )
      AND (
        p_label_query IS NULL
        OR dt.label % p_label_query
        OR dtd.label % p_label_query
      )

    GROUP BY dt.id, dt.data_table_id, dt.label, p.label, c.label, dm.group_key, dm.datasets

    ORDER BY
      CASE
        WHEN p_label_query IS NOT NULL
          THEN GREATEST(
            SIMILARITY(dt.label, p_label_query),
            MAX(COALESCE(SIMILARITY(dtd.label, p_label_query), 0))
          )
        ELSE 0
      END DESC,
      dt.data_table_id ASC

    LIMIT p_limit;
  $$;
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('datasets', {
    component_id: {
      type: 'bigint',
      notNull: false,
      references: 'components(id)',
      onDelete: 'CASCADE',
    },
  })

  pgm.createIndex('datasets', ['component_id'])

  pgm.renameColumn('datasets', 'dataset_param', 'api_endpoint')

  pgm.sql(updatesSearchDataTablesSQL)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.renameColumn('datasets', 'api_endpoint', 'dataset_param')
  pgm.dropColumn('datasets', 'component_id')

  pgm.sql(
    `DROP FUNCTION IF EXISTS search_data_tables(TEXT, TEXT, TEXT, INTEGER);`,
  )
  pgm.sql(searchDataTablesSQL)
}
