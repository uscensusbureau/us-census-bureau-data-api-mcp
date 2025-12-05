import { describe, expect, it } from 'vitest'

import {
  DatasetRecordSchema,
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

      const transformedData = transformApiDatasetsData(rawApiData)

      expect(transformedData[0].name).toEqual(rawApiData[0].title)
      expect(transformedData[0].description).toEqual(rawApiData[0].description)
      expect(transformedData[0].c_vintage).toEqual(rawApiData[0].c_vintage)
      expect(transformedData[0].dataset_param).toEqual('cps/basic/jun')
      expect(transformedData[0].dataset_id).toEqual('DATA1')
    })

    it('skips datasets lacking c_dataset', () => {
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
          title: 'Dataset 2',
          identifier: 'https://api.census.gov/data/id/DATA2',
          description: 'Description 2',
        },
      ]

      const transformedData = transformApiDatasetsData(rawApiData)
      expect(transformedData.length).toEqual(1)
    })
  })
})
