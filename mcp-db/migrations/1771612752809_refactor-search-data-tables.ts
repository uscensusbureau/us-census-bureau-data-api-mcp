import { MigrationBuilder } from 'node-pg-migrate'

import { searchDataTablesSQL } from './1770926658900_add-data-tables-search-functions.js'

export const componentAssignmentSQL = `
  UPDATE datasets d
  SET component_id = c.id
  FROM components c
  WHERE d.component_id IS NULL
  AND d.dataset_param = c.api_endpoint;
`

export const datasetParamAssignmentSQL = `
  UPDATE datasets d
  SET dataset_param = c.api_endpoint
  FROM components c
  WHERE d.component_id = c.id;
`

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
    years          JSONB
  )
  LANGUAGE sql STABLE
  AS $$
    SELECT
      dt.data_table_id,
      dt.label,
      p.label || ' - ' || c.label AS component,
      jsonb_agg(y.year ORDER BY y.year) AS years

    FROM data_tables dt
    JOIN data_table_datasets dtd ON dtd.data_table_id = dt.id
    JOIN datasets             d   ON d.id = dtd.dataset_id
    JOIN components           c   ON c.id = d.component_id
    JOIN programs             p   ON p.id = c.program_id
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
      )

      AND (
        p_label_query IS NULL
        OR dt.label % p_label_query
      )

    GROUP BY dt.id, dt.data_table_id, dt.label, p.label, c.label

    ORDER BY
      CASE
        WHEN p_label_query IS NOT NULL
          THEN SIMILARITY(dt.label, p_label_query)
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

  pgm.sql(componentAssignmentSQL)

  pgm.alterColumn('datasets', 'component_id', {
    notNull: true,
  })

  pgm.createIndex('datasets', ['component_id'])

  pgm.dropColumn('datasets', 'dataset_param')

  pgm.sql(updatesSearchDataTablesSQL)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('datasets', {
    dataset_param: {
      type: 'varchar(100)',
    },
  })

  pgm.sql(datasetParamAssignmentSQL)

  pgm.alterColumn('datasets', 'dataset_param', {
    notNull: true,
  })
  pgm.dropColumn('datasets', 'component_id')

  pgm.sql(
    `DROP FUNCTION IF EXISTS search_data_tables(TEXT, TEXT, TEXT, INTEGER);`,
  )
  pgm.sql(searchDataTablesSQL)
}
