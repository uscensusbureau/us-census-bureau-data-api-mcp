import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'

// Mock the transform function before importing the config
vi.mock('../../../src/schema/data-table.schema', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return {
    ...actual,
    transformDataTableData: vi.fn(),
  }
})

import {
  DataTablesConfig,
  state,
} from '../../../src/seeds/configs/data-tables.config'
import { transformDataTableData } from '../../../src/schema/data-table.schema'

const rawConceptData = [
  {
    CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
    CONCEPT_STRING: 'B16005D',
    DATASET_STRING: 'ACSDT5Y2009',
  },
  {
    CONCEPT_LABEL: 'NATIVITY BY LANGUAGE SPOKEN AT HOME',
    CONCEPT_STRING: 'B16005D',
    DATASET_STRING: 'ACSDT5Y2017',
  },
  {
    CONCEPT_LABEL: 'MEDIAN HOUSEHOLD INCOME',
    CONCEPT_STRING: 'B19013',
    DATASET_STRING: 'ACSDT5Y2009',
  },
]

const transformedData = {
  dataTables: [
    {
      data_table_id: 'B16005D',
      label: 'Nativity by Language Spoken at Home',
    },
    {
      data_table_id: 'B19013',
      label: 'Median Household Income',
    },
  ],
  relationships: [
    {
      data_table_id: 'B16005D',
      dataset_id: 'ACSDT5Y2009',
      label: 'Nativity by Language Spoken at Home',
    },
    {
      data_table_id: 'B16005D',
      dataset_id: 'ACSDT5Y2017',
      label: 'Nativity by Language Spoken at Home',
    },
    {
      data_table_id: 'B19013',
      dataset_id: 'ACSDT5Y2009',
      label: 'Median Household Income',
    },
  ],
}

describe('DataTables Config', () => {
  let mockClient: Partial<Client>

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    }

    state.capturedRelationships = []
  })

  afterEach(() => {
    vi.mocked(transformDataTableData).mockClear()
  })

  it('should have valid configuration structure', () => {
    expect(DataTablesConfig).toBeDefined()
    expect(DataTablesConfig.file).toBe('concept.csv')
    expect(DataTablesConfig.table).toBe('data_tables')
    expect(DataTablesConfig.conflictColumn).toBe('data_table_id')
    expect(DataTablesConfig.beforeSeed).toBeDefined()
    expect(DataTablesConfig.afterSeed).toBeDefined()
  })

  describe('beforeSeed', () => {
    it('calls transformDataTableData with correct raw data', () => {
      const dataCopy = [...rawConceptData]

      vi.mocked(transformDataTableData).mockReturnValue(transformedData)

      DataTablesConfig.beforeSeed!(mockClient as Client, dataCopy)

      expect(transformDataTableData).toHaveBeenCalledTimes(1)
      expect(transformDataTableData).toHaveBeenCalledWith(dataCopy)
    })

    it('transforms and replaces data with dataTables only', () => {
      const dataCopy = [...rawConceptData]

      vi.mocked(transformDataTableData).mockReturnValue(transformedData)

      DataTablesConfig.beforeSeed!(mockClient as Client, dataCopy)

      expect(dataCopy).toHaveLength(transformedData.dataTables.length)
      expect(dataCopy[0]).toEqual(transformedData.dataTables[0])
      expect(dataCopy[1]).toEqual(transformedData.dataTables[1])
    })

    it('clears original data before pushing transformed data', () => {
      const dataCopy = [...rawConceptData]
      const lengthSpy = vi.fn()

      vi.mocked(transformDataTableData).mockImplementation((data) => {
        lengthSpy((data as unknown[]).length)
        return transformedData
      })

      DataTablesConfig.beforeSeed!(mockClient as Client, dataCopy)

      // Verify data was passed with original length
      expect(lengthSpy).toHaveBeenCalledWith(rawConceptData.length)

      // Verify final data matches transformed dataTables
      expect(dataCopy).toEqual(transformedData.dataTables)
    })
  })

  describe('afterSeed', () => {
    it('should map string IDs to numeric IDs and insert relationships', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      // Mock the ID lookup queries
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, data_table_id: 'B16005D' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      // Should have been called 3 times (2 lookups + 1 insert)
      expect(mockQuery).toHaveBeenCalledTimes(3)

      // Verify the insert query has numeric IDs
      const insertCall = mockQuery.mock.calls[2]
      const insertParams = insertCall[1]

      expect(insertParams[0]).toBe(1) // numeric data_table_id
      expect(insertParams[1]).toBe(10) // numeric dataset_id
      expect(insertParams[2]).toBe('Nativity by Language Spoken at Home')
    })

    it('should handle empty relationships', async () => {
      state.capturedRelationships = []

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      await DataTablesConfig.afterSeed!(mockClient as Client)

      // Should not execute any queries
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('should warn and skip relationships with missing IDs', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'UNKNOWN',
          dataset_id: 'ACSDT5Y2009',
          label: 'Test',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {})

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // No matching data_table
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Could not find numeric ID for data_table_id: UNKNOWN',
        ),
      )

      // Should only call lookup queries, not insert
      expect(mockQuery).toHaveBeenCalledTimes(2)

      consoleWarnSpy.mockRestore()
    })

    it('should reset the capturedRelationships after inserting data', async () => {
      // Set up captured relationships with string IDs
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, data_table_id: 'B16005D' }],
        }) // data_tables lookup
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        }) // datasets lookup
        .mockResolvedValueOnce({ rows: [] }) // insert

      await DataTablesConfig.afterSeed!(mockClient as Client)

      expect(state.capturedRelationships).toEqual([])
    })

    it('should insert into data_tables_datasets table', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, data_table_id: 'B16005D' }],
        }) // data_tables lookup
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        }) // datasets lookup
        .mockResolvedValueOnce({ rows: [] }) // insert

      await DataTablesConfig.afterSeed!(mockClient as Client)

      // Verify the insert query targets the correct table
      const insertCall = mockQuery.mock.calls[2]
      const insertSQL = insertCall[0]

      expect(insertSQL).toContain('INSERT INTO data_table_datasets')
      expect(insertSQL).toContain('(data_table_id, dataset_id, label)')
      expect(insertSQL).toContain(
        'ON CONFLICT (data_table_id, dataset_id) DO NOTHING',
      )
    })

    it('should include all three columns in the insert', async () => {
      state.capturedRelationships = [
        {
          data_table_id: 'B16005D',
          dataset_id: 'ACSDT5Y2009',
          label: 'Nativity by Language Spoken at Home',
        },
      ]

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, data_table_id: 'B16005D' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 10, dataset_id: 'ACSDT5Y2009' }],
        })
        .mockResolvedValueOnce({ rows: [] })

      await DataTablesConfig.afterSeed!(mockClient as Client)

      const insertCall = mockQuery.mock.calls[2]
      const insertSQL = insertCall[0]

      // Verify all three columns are included
      expect(insertSQL).toMatch(/data_table_id.*dataset_id.*label/)
    })

    it('should process large batches correctly', async () => {
      // Create 10,000 relationships to test batching (BATCH_SIZE = 5000)
      const manyRelationships = Array.from({ length: 10000 }, (_, i) => ({
        data_table_id: `TABLE_${i % 100}`,
        dataset_id: `DATASET_${i % 50}`,
        label: `Label ${i}`,
      }))

      state.capturedRelationships = manyRelationships

      const mockQuery = mockClient.query as ReturnType<typeof vi.fn>

      // Mock lookup queries - return mock IDs for all unique tables/datasets
      const uniqueTableIds = [
        ...new Set(manyRelationships.map((r) => r.data_table_id)),
      ]
      const uniqueDatasetIds = [
        ...new Set(manyRelationships.map((r) => r.dataset_id)),
      ]

      mockQuery
        .mockResolvedValueOnce({
          rows: uniqueTableIds.map((id, idx) => ({
            id: idx + 1,
            data_table_id: id,
          })),
        }) // data_tables lookup
        .mockResolvedValueOnce({
          rows: uniqueDatasetIds.map((id, idx) => ({
            id: idx + 1,
            dataset_id: id,
          })),
        }) // datasets lookup

      // Mock insert queries for each batch
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // batch 1
        .mockResolvedValueOnce({ rows: [] }) // batch 2

      await DataTablesConfig.afterSeed!(mockClient as Client)

      // Should have 2 lookups + 2 insert batches = 4 calls
      expect(mockQuery).toHaveBeenCalledTimes(4)

      // Verify both inserts happened
      const insertCall1 = mockQuery.mock.calls[2]
      const insertCall2 = mockQuery.mock.calls[3]

      expect(insertCall1[0]).toContain('INSERT INTO data_table_datasets')
      expect(insertCall2[0]).toContain('INSERT INTO data_table_datasets')

      // Verify state was cleared
      expect(state.capturedRelationships).toEqual([])
    })
  })
})
