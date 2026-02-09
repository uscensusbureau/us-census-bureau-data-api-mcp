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
  parseTemporalRange: vi.fn(),
  TransformedDatasetsArraySchema: {
    parse: vi.fn(),
  },
  DatasetRecordSchema: {},
}))

vi.mock('../../../src/helpers/get-or-create-year.helper', () => ({
  getOrCreateYear: vi.fn(),
}))

vi.mock('../../../src/helpers/create-dataset-topics.helper', () => ({
  createDatasetTopics: vi.fn(),
}))

import { cleanupWithRetry } from '../../test-helpers/database-cleanup'
import { dbConfig } from '../../test-helpers/database-config'
import { DatasetConfig } from '../../../src/seeds/configs/dataset.config'
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner'
import {
  DatasetRecord,
  parseTemporalRange,
  transformApiDatasetsData,
  TransformedDataset,
  TransformedDatasetsArraySchema,
} from '../../../src/schema/dataset.schema'
import { getOrCreateYear } from '../../../src/helpers/get-or-create-year.helper'
import { createDatasetTopics } from '../../../src/helpers/create-dataset-topics.helper'

describe('Dataset Config', () => {
  let runner: SeedRunner
  let client: Client
  let databaseUrl: string

  beforeAll(async () => {
    client = new Client(dbConfig)
    await client.connect()

    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    vi.mocked(transformApiDatasetsData).mockClear()
    vi.mocked(parseTemporalRange).mockClear()
    vi.mocked(getOrCreateYear).mockClear()
    vi.mocked(TransformedDatasetsArraySchema.parse).mockClear()
    vi.mocked(createDatasetTopics).mockClear()

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
    expect(datasetSeed?.afterSeed).toBeDefined()
  })

  describe('afterSeed', () => {
    let mockClient: Partial<Client>

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
      }
    })

    it('should call createDatasetTopics with the client', async () => {
      await DatasetConfig.afterSeed!(mockClient as Client)

      expect(createDatasetTopics).toHaveBeenCalledTimes(1)
      expect(createDatasetTopics).toHaveBeenCalledWith(mockClient)
    })
  })

  describe('beforeSeed', () => {
    let mockClient: Partial<Client>

    beforeEach(() => {
      mockClient = {
        query: vi.fn(),
      }
    })

    it('should call createDatasetTopics with the client', async () => {
      await DatasetConfig.afterSeed!(mockClient as Client)

      expect(createDatasetTopics).toHaveBeenCalledTimes(1)
      expect(createDatasetTopics).toHaveBeenCalledWith(mockClient)
    })
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
          c_isAggregate: true,
          title: 'Jun 1994 Current Population Survey: Basic Monthly',
          identifier: 'https://api.census.gov/data/id/CPSBASIC199406',
          description: 'Description',
        },
      ]

      const transformedData: TransformedDataset[] = [
        {
          name: 'Jun 1994 Current Population Survey: Basic Monthly',
          description: 'Description',
          c_vintage: 1994,
          type: 'aggregate',
          dataset_id: 'CPSBASIC199406',
          dataset_param: 'cps/basic/jun',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
        transformedData,
      )
      vi.mocked(getOrCreateYear).mockResolvedValue(1)
      vi.mocked(parseTemporalRange).mockReturnValue({
        temporal_start: null,
        temporal_end: null,
      })

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(transformApiDatasetsData).toHaveBeenCalledTimes(1)
      expect(transformApiDatasetsData).toHaveBeenCalledWith(rawApiData)
      expect(TransformedDatasetsArraySchema.parse).toHaveBeenCalledTimes(1)
    })

    it('should throw error if validation fails', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          c_isAggregate: true,
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
      ]

      const transformedData: TransformedDataset[] = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          type: 'aggregate',
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

      expect(getOrCreateYear).not.toHaveBeenCalled()
    })

    it('should call getOrCreateYear for each dataset with c_vintage', async () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          c_isAggregate: true,
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
        {
          c_vintage: 2020,
          c_dataset: ['acs', 'acs1'],
          c_isTimeseries: true,
          title: 'Dataset 2',
          identifier: 'https://api.census.gov/data/id/DATA2',
          description: 'Description 2',
        },
      ]

      const transformedData: TransformedDataset[] = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          type: 'aggregate',
          dataset_id: 'DATA1',
          dataset_param: 'cps/basic/jun',
        },
        {
          name: 'Dataset 2',
          description: 'Description 2',
          c_vintage: 2020,
          type: 'timeseries',
          dataset_id: 'DATA2',
          dataset_param: 'acs/acs1',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
        transformedData,
      )
      vi.mocked(parseTemporalRange).mockReturnValue({
        temporal_start: null,
        temporal_end: null,
      })
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
          c_isAggregate: true,
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
      ]

      const transformedData: TransformedDataset[] = [
        {
          name: 'Dataset 1',
          description: 'Description 1',
          c_vintage: 1994,
          type: 'aggregate',
          dataset_id: 'DATA1',
          dataset_param: 'cps/basic/jun',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
        transformedData,
      )
      vi.mocked(parseTemporalRange).mockReturnValue({
        temporal_start: null,
        temporal_end: null,
      })
      vi.mocked(getOrCreateYear).mockResolvedValue(42)

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(Array.isArray(rawApiData)).toBe(true)
      expect(rawApiData).toHaveLength(1)

      const processedDataset = rawApiData[0]
      expect(processedDataset).toEqual({
        name: 'Dataset 1',
        description: 'Description 1',
        type: 'aggregate',
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
          c_isMicrodata: true,
          title: 'Dataset Without Vintage',
          identifier: 'https://api.census.gov/data/id/DATANOVINTAGE',
          description: 'No vintage',
        },
      ]

      const transformedData: TransformedDataset[] = [
        {
          name: 'Dataset Without Vintage',
          description: 'No vintage',
          type: 'microdata',
          dataset_id: 'DATANOVINTAGE',
          dataset_param: 'acs/acs1',
        },
      ]

      vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
      vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
        transformedData,
      )
      vi.mocked(parseTemporalRange).mockReturnValue({
        temporal_start: null,
        temporal_end: null,
      })

      await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

      expect(getOrCreateYear).not.toHaveBeenCalled()

      const processedDataset = rawApiData[0]
      expect(processedDataset).not.toHaveProperty('year_id')
      expect(processedDataset).not.toHaveProperty('c_vintage')
    })

    describe('temporal data handling', () => {
      it('should call parseTemporalRange when temporal is present', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Dataset with Temporal',
            identifier: 'https://api.census.gov/data/id/TEMPORAL1',
            description: 'Has temporal data',
            temporal: '2020/2023',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Dataset with Temporal',
            description: 'Has temporal data',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'TEMPORAL1',
            dataset_param: 'acs/acs1',
            temporal: '2020/2023',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(getOrCreateYear).mockResolvedValue(1)
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: new Date(2020, 0, 1),
          temporal_end: new Date(2023, 11, 31),
        })

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(parseTemporalRange).toHaveBeenCalledTimes(1)
        expect(parseTemporalRange).toHaveBeenCalledWith('2020/2023')
      })

      it('should assign temporal dates to final data', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Dataset with Temporal',
            identifier: 'https://api.census.gov/data/id/TEMPORAL1',
            description: 'Has temporal data',
            temporal: '2020-01/2020-12',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Dataset with Temporal',
            description: 'Has temporal data',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'TEMPORAL1',
            dataset_param: 'acs/acs1',
            temporal: '2020-01/2020-12',
          },
        ]

        const startDate = new Date(2020, 0, 1)
        const endDate = new Date(2020, 11, 31)

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(getOrCreateYear).mockResolvedValue(1)
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: startDate,
          temporal_end: endDate,
        })

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        const processedDataset = rawApiData[0] as Partial<DatasetRecord>
        expect(processedDataset.temporal_start).toEqual(startDate)
        expect(processedDataset.temporal_end).toEqual(endDate)
        expect(processedDataset).not.toHaveProperty('temporal')
      })

      it('should not call parseTemporalRange when temporal is absent', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Dataset without Temporal',
            identifier: 'https://api.census.gov/data/id/NOTEMPORAL',
            description: 'No temporal data',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Dataset without Temporal',
            description: 'No temporal data',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'NOTEMPORAL',
            dataset_param: 'acs/acs1',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(getOrCreateYear).mockResolvedValue(1)

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(parseTemporalRange).not.toHaveBeenCalled()

        const processedDataset = rawApiData[0] as Partial<DatasetRecord>
        expect(processedDataset.temporal_start).toBe(null)
        expect(processedDataset.temporal_end).toBe(null)
      })
    })

    describe('deduplication', () => {
      it('should remove duplicate dataset_ids', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Dataset 1',
            identifier: 'https://api.census.gov/data/id/DUPLICATE',
            description: 'First occurrence',
          },
          {
            c_vintage: 2021,
            c_dataset: ['acs', 'acs5'],
            c_isTimeseries: true,
            title: 'Dataset 2',
            identifier: 'https://api.census.gov/data/id/DUPLICATE',
            description: 'Second occurrence',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Dataset 1',
            description: 'First occurrence',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'DUPLICATE',
            dataset_param: 'acs/acs1',
          },
          {
            name: 'Dataset 2',
            description: 'Second occurrence',
            c_vintage: 2021,
            type: 'timeseries',
            dataset_id: 'DUPLICATE',
            dataset_param: 'acs/acs5',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: null,
          temporal_end: null,
        })
        vi.mocked(getOrCreateYear).mockResolvedValue(1)

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(rawApiData).toHaveLength(1)
        const processedDataset = rawApiData[0] as Partial<DatasetRecord>

        expect(processedDataset.dataset_id).toBe('DUPLICATE')
        expect(processedDataset.description).toBe('Second occurrence')
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Found 1 duplicate dataset_id(s); keeping last occurence of each:',
          ['DUPLICATE (2 occurrences)'],
        )

        consoleWarnSpy.mockRestore()
      })

      it('should filter out datasets without dataset_id', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Valid Dataset',
            identifier: 'https://api.census.gov/data/id/VALID',
            description: 'Has ID',
          },
          {
            c_vintage: 2021,
            c_dataset: ['acs', 'acs5'],
            c_isTimeseries: true,
            title: 'Invalid Dataset',
            identifier: '',
            description: 'No ID',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Valid Dataset',
            description: 'Has ID',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'VALID',
            dataset_param: 'acs/acs1',
          },
          {
            name: 'Invalid Dataset',
            description: 'No ID',
            c_vintage: 2021,
            type: 'timeseries',
            dataset_id: '',
            dataset_param: 'acs/acs5',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: null,
          temporal_end: null,
        })
        vi.mocked(getOrCreateYear).mockResolvedValue(1)

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)
        const processedDataset = rawApiData[0] as Partial<DatasetRecord>

        expect(rawApiData).toHaveLength(1)
        expect(processedDataset.dataset_id).toBe('VALID')
      })

      it('should handle no duplicates without warnings', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Dataset 1',
            identifier: 'https://api.census.gov/data/id/DATA1',
            description: 'First',
          },
          {
            c_vintage: 2021,
            c_dataset: ['acs', 'acs5'],
            c_isTimeseries: true,
            title: 'Dataset 2',
            identifier: 'https://api.census.gov/data/id/DATA2',
            description: 'Second',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Dataset 1',
            description: 'First',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'DATA1',
            dataset_param: 'acs/acs1',
          },
          {
            name: 'Dataset 2',
            description: 'Second',
            c_vintage: 2021,
            type: 'timeseries',
            dataset_id: 'DATA2',
            dataset_param: 'acs/acs5',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: null,
          temporal_end: null,
        })
        vi.mocked(getOrCreateYear).mockResolvedValue(1)

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(rawApiData).toHaveLength(2)
        expect(consoleWarnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('duplicate'),
          expect.anything(),
        )

        consoleWarnSpy.mockRestore()
      })
    })

    describe('datasets without type', () => {
      it('should exclude datasets without a type and log warning', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            c_isAggregate: true,
            title: 'Valid Dataset',
            identifier: 'https://api.census.gov/data/id/VALID',
            description: 'Has type',
          },
          {
            c_vintage: 2021,
            c_dataset: ['acs', 'acs5'],
            title: 'Dataset Without Type',
            identifier: 'https://api.census.gov/data/id/NOTYPE',
            description: 'Missing type flag',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'Valid Dataset',
            description: 'Has type',
            c_vintage: 2020,
            type: 'aggregate',
            dataset_id: 'VALID',
            dataset_param: 'acs/acs1',
          },
          {
            name: 'Dataset Without Type',
            description: 'Missing type flag',
            c_vintage: 2021,
            type: undefined as unknown as
              | 'aggregate'
              | 'timeseries'
              | 'microdata',
            dataset_id: 'NOTYPE',
            dataset_param: 'acs/acs5',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )
        vi.mocked(parseTemporalRange).mockReturnValue({
          temporal_start: null,
          temporal_end: null,
        })
        vi.mocked(getOrCreateYear).mockResolvedValue(1)

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(rawApiData).toHaveLength(1)
        expect(rawApiData[0]).toEqual({
          name: 'Valid Dataset',
          description: 'Has type',
          type: 'aggregate',
          dataset_id: 'VALID',
          dataset_param: 'acs/acs1',
          temporal_start: null,
          temporal_end: null,
          year_id: 1,
        })

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Excluding dataset NOTYPE - no type flag set',
        )

        consoleWarnSpy.mockRestore()
      })

      it('should exclude all datasets without type if none have type', async () => {
        const rawApiData = [
          {
            c_vintage: 2020,
            c_dataset: ['acs', 'acs1'],
            title: 'No Type 1',
            identifier: 'https://api.census.gov/data/id/NOTYPE1',
            description: 'Missing type',
          },
          {
            c_vintage: 2021,
            c_dataset: ['acs', 'acs5'],
            title: 'No Type 2',
            identifier: 'https://api.census.gov/data/id/NOTYPE2',
            description: 'Missing type',
          },
        ]

        const transformedData: TransformedDataset[] = [
          {
            name: 'No Type 1',
            description: 'Missing type',
            c_vintage: 2020,
            type: undefined,
            dataset_id: 'NOTYPE1',
            dataset_param: 'acs/acs1',
          },
          {
            name: 'No Type 2',
            description: 'Missing type',
            c_vintage: 2021,
            type: undefined,
            dataset_id: 'NOTYPE2',
            dataset_param: 'acs/acs5',
          },
        ]

        vi.mocked(transformApiDatasetsData).mockReturnValue(transformedData)
        vi.mocked(TransformedDatasetsArraySchema.parse).mockReturnValue(
          transformedData,
        )

        const consoleWarnSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {})

        await DatasetConfig.beforeSeed!(mockClient as Client, rawApiData)

        expect(rawApiData).toHaveLength(0)
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Excluding dataset NOTYPE1 - no type flag set',
        )
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Excluding dataset NOTYPE2 - no type flag set',
        )

        consoleWarnSpy.mockRestore()
      })
    })
  })
})
