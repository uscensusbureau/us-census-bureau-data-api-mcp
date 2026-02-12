import { Client } from 'pg'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import {
  transformDataTableData,
  DataTableDatasetRecord,
} from '../../schema/data-table.schema.js'

// Use an object so tests can mutate it
export const state = {
  capturedRelationships: [] as DataTableDatasetRecord[],
}

export const DataTablesConfig: SeedConfig = {
  file: 'concept.csv',
  table: 'data_tables',
  conflictColumn: 'data_table_id',
  beforeSeed: (client: Client, rawData: unknown[]): void => {
    const { dataTables, relationships } = transformDataTableData(rawData)

    // Store relationships for afterSeed
    state.capturedRelationships = relationships

    // Replace rawData with deduplicated data tables
    rawData.length = 0
    rawData.push(...dataTables)
  },
  afterSeed: async (client: Client): Promise<void> => {
    if (state.capturedRelationships.length === 0) {
      console.log('No data_table <-> dataset relationships to insert')
      return
    }

    // Build ID maps (your existing code)
    const dataTableIds = [...new Set(state.capturedRelationships.map(r => r.data_table_id))]
    const dataTableQuery = await client.query(
      `SELECT id, data_table_id FROM data_tables WHERE data_table_id = ANY($1)`,
      [dataTableIds]
    )
    const dataTableIdMap = new Map<string, number>(
      dataTableQuery.rows.map(row => [row.data_table_id, parseInt(row.id, 10)])
    )

    const datasetIds = [...new Set(state.capturedRelationships.map(r => r.dataset_id))]
    const datasetQuery = await client.query(
      `SELECT id, dataset_id FROM datasets WHERE dataset_id = ANY($1)`,
      [datasetIds]
    )
    const datasetIdMap = new Map<string, number>(
      datasetQuery.rows.map(row => [row.dataset_id, parseInt(row.id, 10)])
    )

    // Map string IDs to numeric IDs (your existing code)
    const joinRecords = state.capturedRelationships
      .map(rel => {
        const dataTableNumericId = dataTableIdMap.get(rel.data_table_id)
        const datasetNumericId = datasetIdMap.get(rel.dataset_id)

        if (!dataTableNumericId) {
          console.warn(`Could not find numeric ID for data_table_id: ${rel.data_table_id}`)
          return null
        }
        if (!datasetNumericId) {
          console.warn(`Could not find numeric ID for dataset_id: ${rel.dataset_id}`)
          return null
        }

        return {
          data_table_id: dataTableNumericId,
          dataset_id: datasetNumericId,
          label: rel.label,
        }
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)

    if (joinRecords.length === 0) {
      console.log('No valid relationships to insert (missing IDs)')
      state.capturedRelationships = []
      return
    }

    // Manual batching - no SeedRunner needed
    const BATCH_SIZE = 5000
    const totalBatches = Math.ceil(joinRecords.length / BATCH_SIZE)
    
    console.log(`Processing ${joinRecords.length} records in batches of ${BATCH_SIZE}`)

    for (let i = 0; i < joinRecords.length; i += BATCH_SIZE) {
      const batch = joinRecords.slice(i, i + BATCH_SIZE)
      console.log(
        `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`,
      )

      const columns = Object.keys(batch[0])
      const values = batch.map((record) =>
        columns.map((col) => record[col as keyof typeof record])
      )

      const placeholders = values
        .map(
          (_, idx) =>
            `(${columns.map((_, j) => `$${idx * columns.length + j + 1}`).join(', ')})`
        )
        .join(', ')

      const query = `
        INSERT INTO data_table_datasets (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (data_table_id, dataset_id) DO NOTHING
      `

      await client.query(query, values.flat())
      
      // Small delay between batches
      if (i + BATCH_SIZE < joinRecords.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log(`Inserted ${joinRecords.length} data_table <-> dataset relationships`)
    state.capturedRelationships = []
  }
}
