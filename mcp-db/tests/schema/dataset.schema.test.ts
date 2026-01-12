import { describe, expect, it } from 'vitest'

import {
  ApiDataset,
  DatasetRecordSchema,
  determineDatasetType,
  parseTemporalRange,
  transformApiDatasetsData,
} from '../../src/schema/dataset.schema'

describe('Dataset Schema', () => {
  describe('DatasetRecordSchema', () => {
    it('validates a complete record', () => {
      const datasetRecord = {
        name: 'Dataset',
        description: 'A great dataset.',
        dataset_id: 'ACSY123456',
        dataset_param: 'acs/acs1',
        type: 'aggregate',
        year_id: 1,
      }

      const result = DatasetRecordSchema.safeParse(datasetRecord)

      expect(result.success).toBe(true)
    })
    it('invalidates an incomplete record', () => {
      const datasetRecord = {
        description: 'A great dataset.',
        dataset_id: 'ACSY123456',
        dataset_param: 'acs/acs1',
        type: 'aggregate',
        year_id: 1,
      }

      const result = DatasetRecordSchema.safeParse(datasetRecord)

      expect(result.success).toBe(false)
    })
  })

  describe('transformApiDatasetsData', () => {
    it('transforms raw API data for storage', () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          c_isMicrodata: true,
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
        {
          c_vintage: 2020,
          c_dataset: ['acs', 'acs1'],
          c_isAggregate: true,
          title: 'Dataset 2',
          identifier: 'https://api.census.gov/data/id/DATA2',
          description: 'Description 2',
        },
      ]

      const transformedData = transformApiDatasetsData(rawApiData)

      expect(transformedData[0].name).toEqual(rawApiData[0].title)
      expect(transformedData[0].description).toEqual(rawApiData[0].description)
      expect(transformedData[0].c_vintage).toEqual(rawApiData[0].c_vintage)
      expect(transformedData[0].dataset_param).toEqual('cps/basic/jun')
      expect(transformedData[0].dataset_id).toEqual('DATA1')
      expect(transformedData[0].type).toEqual('microdata')
    })

    it('skips datasets lacking c_dataset', () => {
      const rawApiData = [
        {
          c_vintage: 1994,
          c_dataset: ['cps', 'basic', 'jun'],
          c_isMicrodata: true,
          title: 'Dataset 1',
          identifier: 'https://api.census.gov/data/id/DATA1',
          description: 'Description 1',
        },
        {
          c_vintage: 2020,
          c_isAggregate: true,
          title: 'Dataset 2',
          identifier: 'https://api.census.gov/data/id/DATA2',
          description: 'Description 2',
        },
      ]

      const transformedData = transformApiDatasetsData(rawApiData)
      expect(transformedData.length).toEqual(1)
    })
  })

  describe('determineDatasetType', () => {
    describe('when the item argument matches a valid dataset type', () => {
      it('assigns aggregate type correctly', () => {
        const datasetAggregate: ApiDataset = {
          title: 'Aggregate Dataset',
          identifier: '1234',
          description: 'An aggregate dataset.',
          c_isAggregate: true,
        }
        expect(determineDatasetType(datasetAggregate)).toBe('aggregate')
      })

      it('assigns timeseries type correctly', () => {
        const datasetTimeseries: ApiDataset = {
          title: 'Timeseries Dataset',
          identifier: '5678',
          description: 'A timeseries dataset.',
          c_isTimeseries: true,
        }
        expect(determineDatasetType(datasetTimeseries)).toBe('timeseries')
      })

      it('assigns microdata type correctly', () => {
        const datasetMicrodata: ApiDataset = {
          title: 'Microdata Dataset',
          identifier: '9012',
          description: 'A microdata dataset.',
          c_isMicrodata: true,
        }
        expect(determineDatasetType(datasetMicrodata)).toBe('microdata')
      })
    })

    describe('when the item argument does not match a valid dataset type', () => {
      it('throws an error', () => {
        const datasetNoType: ApiDataset = {
          title: 'Invalid Dataset',
          identifier: '3456',
          description: 'A dataset with no type flag.',
        }
        expect(() => determineDatasetType(datasetNoType)).toThrow(
          'Dataset 3456 has no type flag set'
        )
      })
    })
  })

  describe('parseTemporalRange', () => {
    describe('when a temporal is in a YYYY/YYYY format', () => {
      it('parses the temporal and assigns each value properly', () => {
        const temporal = '2026/2026'
        const expected_start_date = new Date(2026, 0, 1)
        const expected_end_date = new Date(2026, 11, 31)

        expect(parseTemporalRange(temporal).temporal_start).toEqual(expected_start_date)
        expect(parseTemporalRange(temporal).temporal_end).toEqual(expected_end_date)
      })
    })

    describe('when a temporal is in a YYYY-MM/YYYY-MM format', () => {
      it('parses the temporal and assigns each value properly', () => {
        const temporal = '2026-01/2026-01'
        const expected_start_date = new Date(2026, 0, 1)
        const expected_end_date = new Date(2026, 0, 31)

        expect(parseTemporalRange(temporal).temporal_start).toEqual(expected_start_date)
        expect(parseTemporalRange(temporal).temporal_end).toEqual(expected_end_date)
      })
    })

    describe('when a temporal is improperly formatted', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = '2026-2026'

        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null) // Fixed: was temporal_start
      })
    })

    describe('when the parsed start month is not a number', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = '2026-One/2026-01'

        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null)
      })
    })

    describe('when the parsed end month is not a number', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = '2026-02/2026-Two'

        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null)
      })
    })

    describe('when the parsed start year is not a number', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = 'Twentytwentysix/2026'

        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null)
      })
    })

    describe('when the parsed end year is not a number', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = '2026/Twentytwentysix'

        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null)
      })
    })

    describe('when an unexpected error occurs during parsing', () => {
      it('returns null values for temporal_start and temporal_end', () => {
        const temporal = { split: () => { throw new Error('Unexpected error') } } as any
        
        expect(parseTemporalRange(temporal).temporal_start).toBe(null)
        expect(parseTemporalRange(temporal).temporal_end).toBe(null)
      })
    })
  })
})
