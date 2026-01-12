import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest'
import { Client } from 'pg'

// Mock before imports
vi.mock('../../../src/schema/dataset.schema', () => ({
  transformApiDatasetsData: vi.fn(),
  TransformedDatasetsArraySchema: {
    parse: vi.fn(),
  },
  DatasetRecordSchema: {}, // Include other exports if needed
}))

vi.mock('../../../src/helpers/get-or-create-year.helper', () => ({
  getOrCreateYear: vi.fn(),
}))

import { cleanupWithRetry } from '../../helpers/database-cleanup'
import { dbConfig } from '../../helpers/database-config'
import { DatasetConfig } from '../../../src/seeds/configs/dataset.config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import {
  transformApiDatasetsData,
  TransformedDataset,
  TransformedDatasetsArraySchema,
} from '../../../src/schema/dataset.schema'
import { getOrCreateYear } from '../../../src/helpers/get-or-create-year.helper'

describe('Dataset Config', () => {
  let runner: SeedRunner
  let client: Client
  let databaseUrl: string

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    // Construct database URL for SeedRunner
    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    // Clear the mocks between tests
    vi.mocked(transformApiDatasetsData).mockClear()
    vi.mocked(getOrCreateYear).mockClear()
    vi.mocked(TransformedDatasetsArraySchema.parse).mockClear()

    runner = new SeedRunner(databaseUrl)
    await runner.connect()

    await cleanupWithRetry(client, ['datasets', 'years'])
  })

  afterEach(async () => {
    await runner.disconnect()
  })

  it('should have valid configuration structure', () => {
    const datasetSeed = DatasetConfig

    expect(datasetSeed).toBeDefined()
    expect(datasetSeed?.table).toBe('datasets')
    expect(datasetSeed?.conflictColumn).toBe('dataset_id')
    expect(datasetSeed?.dataPath).toBe('dataset')
    expect(datasetSeed?.alwaysFetch).toBe(true)
    expect(datasetSeed?.beforeSeed).toBeDefined()
  })

  describe('beforeSeed', () => {
    let mockClient: Partial<Client>

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
      }
    })

    it('should call transformApiDatasetsData and validate with schema', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          title: 'Jun 1994 Current Population Survey: Basic Monthly',
          identifier: 'https://api.census.gov/data/id/CPSBASIC199406',
          description:
            'To provide estimates of employment, unemployment, and other characteristics of the general labor force, of the population as a whole, and of various subgroups of the population. Monthly labor force data for the country are used by the Bureau of Labor Statistics (BLS) to determine the distribution of funds under the Job Training Partnership Act. These data are collected through combined computer-assisted personal interviewing (CAPI) and computer-assisted telephone interviewing (CATI). In addition to the labor force data, the CPS basic funding provides annual data on work experience, income, and migration from the March Annual Demographic Supplement and on school enrollment of the population from the October Supplement. Other supplements, some of which are sponsored by other agencies, are conducted biennially or intermittently.',
        },
      ]

      const transformedData = [
        {
          name: 'Jun 1994 Current Population Survey: Basic Monthly',
          description:
            'To provide estimates of employment, unemployment, and other characteristics of the general labor force, of the population as a whole, and of various subgroups of the population. Monthly labor force data for the country are used by the Bureau of Labor Statistics (BLS) to determine the distribution of funds under the Job Training Partnership Act. These data are collected through combined computer-assisted personal interviewing (CAPI) and computer-assisted telephone interviewing (CATI). In addition to the labor force data, the CPS basic funding provides annual data on work experience, income, and migration from the March Annual Demographic Supplement and on school enrollment of the population from the October Supplement. Other supplements, some of which are sponsored by other agencies, are conducted biennially or intermittently.',
          c_vintage: 1994,
          dataset_id: 'CPSBASIC199406',
          dataset_param: 'cps/basic/jun',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockImplementation(
        (data) => data as TransformedDataset[],
      )
      vi.mocked(getOrCreateYear).mockResolvedValue(1)

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(transformApiDatasetsData).toHaveBeenCalledTimes(1)
      expect(transformApiDatasetsData).toHaveBeenCalledWith(rawApiData)
      expect(TransformedDatasetsArraySchema.parse).toHaveBeenCalledTimes(1)
      expect(TransformedDatasetsArraySchema.parse).toHaveBeenCalledWith(
        transformedData,
      )
    })

    it('should throw error if validation fails', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
      ]

      const transformedData = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          dataset_id: 'DATA1',
          dataset_param: 'cps/basic/jun',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockImplementation(() => {
        throw new Error('Validation failed: invalid dataset_param')
      })

      await expect(
        DatasetConfig.beforeSeed!(mockClient as Client, rawApiData),
      ).rejects.toThrow('Validation failed: invalid dataset_param')

      // Verify getOrCreateYear was never called due to validation failure
      expect(getOrCreateYear).not.toHaveBeenCalled()
    })

    it('should call getOrCreateYear for each dataset with c_vintage', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
        {
          c_vintage: 2020,
          c_dataset: ['acs', 'acs1'],
          title: 'Dataset 2',
          identifier: 'https://api.census.gov/data/id/DATA2',
          description: 'Description 2',
        },
      ]

      const transformedData = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          dataset_id: 'DATA1',
          dataset_param: 'cps/basic/jun',
        },
        {
          name: 'Dataset 2',
          description: 'Description 2',
          c_vintage: 2020,
          dataset_id: 'DATA2',
          dataset_param: 'acs/acs1',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockImplementation(
        (data) => data as TransformedDataset[],
      )
      vi.mocked(getOrCreateYear)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(getOrCreateYear).toHaveBeenCalledTimes(2)
      expect(getOrCreateYear).toHaveBeenNthCalledWith(1, mockClient, 1994)
      expect(getOrCreateYear).toHaveBeenNthCalledWith(2, mockClient, 2020)
    })

    it('should remove c_vintage and add year_id to final data', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
      ]

      const transformedData = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          dataset_id: 'DATA1',
          dataset_param: 'cps/basic/jun',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockImplementation(
        (data) => data as TransformedDataset[],
      )
      vi.mocked(getOrCreateYear).mockResolvedValue(42)

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      // Check that rawApiData was mutated correctly
      expect(Array.isArray(rawApiData)).toBe(true)
      expect(rawApiData).toHaveLength(1)

      const processedDataset = rawApiData[0]
      expect(processedDataset).toEqual({
        name: 'Dataset 1',
        description: 'Description 1',
        dataset_id: 'DATA1',
        dataset_param: 'cps/basic/jun',
        temporal_start: null,
        temporal_end: null,
        year_id: 42,
      })
      expect(processedDataset).not.toHaveProperty('c_vintage')
    })

    it('should handle datasets without c_vintage', async () => {
      const rawApiData = [
        {
          c_dataset: ['acs', 'acs1'],
          title: 'Dataset Without Vintage',
          identifier: 'https://api.census.gov/data/id/DATANOVINTAGE',
          description: 'No vintage',
        },
      ]

      const transformedData = [
        {
          name: 'Dataset Without Vintage',
          description: 'No vintage',
          dataset_id: 'DATANOVINTAGE',
          dataset_param: 'acs/acs1',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockImplementation(
        (data) => data as TransformedDataset[],
      )

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(getOrCreateYear).not.toHaveBeenCalled()

      const processedDataset = rawApiData[0]
      expect(processedDataset).not.toHaveProperty('year_id')
      expect(processedDataset).not.toHaveProperty('c_vintage')
    })
  })
})
