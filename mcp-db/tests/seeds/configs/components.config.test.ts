import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'

import { ComponentsConfig } from '../../../src/seeds/configs/components.config'

vi.mock('../../../src/schema/components.schema', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/schema/components.schema')
    >()
  return {
    ...actual,
    transformComponentData: vi.fn(actual.transformComponentData),
  }
})

import { transformComponentData } from '../../../src/schema/components.schema'

const fixtureRows = [
  {
    COMPONENT_STRING: 'ACSSE',
    COMPONENT_LABEL: '1-Year Supplemental Estimates',
    COMPONENT_DESCRIPTION: 'ACS 1-Year Supplemental Estimates.',
    API_SHORT_NAME: 'acs/acsse',
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
    FREQUENCY: 'Annual',
    FREQUENCY_NOTES:
      'Released roughly one month after standard 1-year products.',
    PROGRAM_DESCRIPTION:
      'Continuous monthly survey pooled into 1-year and 5-year estimates.',
  },
  {
    COMPONENT_STRING: 'ACSDT5Y',
    COMPONENT_LABEL: 'Detailed Tables 5-Year',
    COMPONENT_DESCRIPTION: 'ACS 5-Year Detailed Tables.',
    API_SHORT_NAME: 'acs/acs5',
    PROGRAM_STRING: 'ACS',
    PROGRAM_LABEL: 'American Community Survey',
    FREQUENCY: 'Annual',
    FREQUENCY_NOTES: '',
    PROGRAM_DESCRIPTION:
      'Continuous monthly survey pooled into 1-year and 5-year estimates.',
  },
]

describe('Components Config', () => {
  let client: Client
  let mockProgramIdMap: Map<string, number>

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockProgramIdMap = new Map([['ACS', 1]])

    client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 1, acronym: 'ACS' }],
        rowCount: 1,
      }),
    } as unknown as Client
  })

  it('should have valid configuration structure', () => {
    expect(ComponentsConfig).toBeDefined()
    expect(ComponentsConfig.table).toBe('components')
    expect(ComponentsConfig.file).toBe('components-programs.csv')
    expect(ComponentsConfig.conflictColumn).toBe('component_id')
    expect(ComponentsConfig.beforeSeed).toBeDefined()
  })

  describe('beforeSeed logic', () => {
    it('should query programs from the database', async () => {
      const rawData: unknown[] = [...fixtureRows]
      await ComponentsConfig.beforeSeed!(client, rawData)
      expect(client.query).toHaveBeenCalledWith(
        'SELECT id, acronym FROM programs',
      )
    })

    it('should call transformComponentData with rawData and programIdMap', async () => {
      const rawData: unknown[] = [...fixtureRows]
      await ComponentsConfig.beforeSeed!(client, rawData)
      expect(transformComponentData).toHaveBeenCalledWith(
        rawData,
        mockProgramIdMap,
      )
    })

    it('should replace rawData in place with transformed components', async () => {
      const rawData: unknown[] = [...fixtureRows]
      await ComponentsConfig.beforeSeed!(client, rawData)

      expect((rawData[0] as Record<string, unknown>).component_id).toBeDefined()
      expect(
        (rawData[0] as Record<string, unknown>).COMPONENT_STRING,
      ).toBeUndefined()
    })

    it('should handle empty data array', async () => {
      client = {
        query: vi.fn().mockResolvedValue({
          rows: [],
          rowCount: 0,
        }),
      } as unknown as Client

      await expect(ComponentsConfig.beforeSeed!(client, [])).rejects.toThrow(
        'transformComponentData called with empty programIdMap — ensure programs are seeded before components',
      )
    })
  })
})
