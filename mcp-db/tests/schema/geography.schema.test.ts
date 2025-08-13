import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GeographyMappings,
  GeographyValueValidators,
  SummaryLevels,
  transformApiGeographyData,
} from '../../src/schema/geography.schema'

describe('Geography Schema', () => {
  let mockTime: Date
  beforeEach(() => {
    vi.useFakeTimers()

    mockTime = new Date('2024-03-15T10:30:00.000Z')
    vi.setSystemTime(mockTime)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
  describe('GeographyMappings', () => {
    it('includes the expected mappings', () => {
      expect(GeographyMappings).toBeTypeOf('object')
      expect(GeographyMappings).toMatchObject({
        NAME: 'name',
        GEO_ID: 'ucgid_code',
        SUMLEVEL: 'summary_level_code',
        STATE: 'state_code',
        COUNTY: 'county_code',
        INTPTLAT: 'latitude',
        INTPTLON: 'longitude',
      })
    })
  })

  describe('GeographyValueValidators', () => {
    it('should validate NAME field', () => {
      expect(
        GeographyValueValidators.NAME.safeParse('United States').success,
      ).toBe(true)
      expect(GeographyValueValidators.NAME.safeParse('').success).toBe(false)
    })

    it('should validate GEO_ID field', () => {
      expect(
        GeographyValueValidators.GEO_ID.safeParse('0400000US06').success,
      ).toBe(true)
      expect(GeographyValueValidators.GEO_ID.safeParse('').success).toBe(false)
    })

    it('should validate SUMLEVEL field', () => {
      expect(GeographyValueValidators.SUMLEVEL.safeParse('010').success).toBe(
        true,
      )
      expect(GeographyValueValidators.SUMLEVEL.safeParse(10).success).toBe(
        false,
      )
    })

    it('should validate STATE field', () => {
      expect(GeographyValueValidators.STATE.safeParse('06').success).toBe(true)
      expect(GeographyValueValidators.STATE.safeParse(6).success).toBe(false)
    })

    it('should validate COUNTY field', () => {
      expect(GeographyValueValidators.COUNTY.safeParse('001').success).toBe(
        true,
      )
      expect(GeographyValueValidators.COUNTY.safeParse(100).success).toBe(false)
    })

    it('should validate INTPTLAT field', () => {
      expect(GeographyValueValidators.INTPTLAT.safeParse(37.7749).success).toBe(
        true,
      )
      expect(GeographyValueValidators.INTPTLAT.safeParse(91).success).toBe(
        false,
      )
    })

    it('should validate INTPTLON field', () => {
      expect(
        GeographyValueValidators.INTPTLON.safeParse(-122.4194).success,
      ).toBe(true)
      expect(GeographyValueValidators.INTPTLON.safeParse(181).success).toBe(
        false,
      )
    })
  })

  describe('transformApiGeographyData', () => {
    it('returns a record', () => {
      const validData = [
        ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
        [
          'United States',
          '010',
          '0100000US',
          '34.7366771',
          '-103.2852703',
          '1',
        ],
      ]
      const summaryLevel = 'nation'

      expect(transformApiGeographyData(validData, summaryLevel)).toEqual([
        {
          name: 'United States',
          ucgid_code: '0100000US',
          summary_level_code: '010',
          latitude: 34.7366771,
          longitude: -103.2852703,
          created_at: mockTime.toISOString(),
          updated_at: mockTime.toISOString(),
        },
      ])
    })

    describe('API response validation', () => {
      it('successfully validates an API response with one header and several rows', () => {
        const validData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          [
            'United States',
            '010',
            '0100000US',
            '34.7366771',
            '-103.2852703',
            '1',
          ],
        ]
        const summaryLevel = 'nation'

        expect(transformApiGeographyData(validData, summaryLevel)).toBeDefined()
      })

      it('throws an error if the API response doesn’t have a header and row', () => {
        const invalidData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'], // Missing Row
        ]
        const summaryLevel = 'nation'

        expect(() =>
          transformApiGeographyData(invalidData, summaryLevel),
        ).toThrow()
      })
    })

    describe('Headers validation', () => {
      it('throws no errors if the required headers are present', () => {
        const validData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          [
            'United States',
            '010',
            '0100000US',
            '34.7366771',
            '-103.2852703',
            '1',
          ],
        ]
        const summaryLevel = 'nation'

        expect(transformApiGeographyData(validData, summaryLevel)).toBeDefined()
      })

      it('throws an error if required headers are missing', () => {
        const invalidData = [
          ['NAME', 'SUMLEVEL', 'INTPTLAT', 'INTPTLON', 'us'],
          ['United States', '010', '34.7366771', '-103.2852703', '1'],
        ]
        const summaryLevel = 'nation'

        expect(() =>
          transformApiGeographyData(invalidData, summaryLevel),
        ).toThrow()
      })
    })

    describe('Rows validation', () => {
      it('throws no errors if header count matches row count', () => {
        const validData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          [
            'United States',
            '010',
            '0100000US',
            '34.7366771',
            '-103.2852703',
            '1',
          ],
        ]
        const summaryLevel = 'nation'

        expect(transformApiGeographyData(validData, summaryLevel)).toBeDefined()
      })

      it('throws an error if header and row count don’t match', () => {
        const invalidData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          ['United States', '010', '0100000US', '34.7366771', '1'],
        ]
        const summaryLevel = 'nation'

        expect(() =>
          transformApiGeographyData(invalidData, summaryLevel),
        ).toThrow()
      })
    })

    describe('Latitude and Longitude type conversion', () => {
      let record

      beforeEach(() => {
        const validData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          [
            'United States',
            '010',
            '0100000US',
            '34.7366771',
            '-103.2852703',
            '1',
          ],
        ]
        const summaryLevel = 'nation'

        const result = transformApiGeographyData(validData, summaryLevel)
        record = result[0]
      })

      it('converts latitude to number', () => {
        expect(typeof record.latitude).toBe('number')
        expect(record.latitude).toEqual(34.7366771)
      })
      it('converts longitude to number', () => {
        expect(typeof record.longitude).toBe('number')
        expect(record.longitude).toEqual(-103.2852703)
      })
    })

    describe('Timestamps', () => {
      let record

      beforeEach(() => {
        const validData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          [
            'United States',
            '010',
            '0100000US',
            '34.7366771',
            '-103.2852703',
            '1',
          ],
        ]
        const summaryLevel = 'nation'

        const result = transformApiGeographyData(validData, summaryLevel)
        record = result[0]
      })

      it('defines created_at', () => {
        expect(record.created_at).toEqual(mockTime.toISOString())
      })

      it('defines updated_at', () => {
        expect(record.updated_at).toEqual(mockTime.toISOString())
      })
    })

    describe('Validation', () => {
      it('throws a validation error when the headers don’t match the expected types', () => {
        const invalidData = [
          ['NAME', 'SUMLEVEL', 'GEO_ID', 'INTPTLAT', 'INTPTLON', 'us'],
          ['', '010', '0100000US', '34.7366771', '-103.2852703', '1'], // Empty NAME triggers Zod validation error
        ]
        const summaryLevel = 'nation'

        expect(() =>
          transformApiGeographyData(invalidData, summaryLevel),
        ).toThrow('nation validation failed')
      })
    })
  })

  describe('SummaryLevels', () => {
    let requiredFields

    beforeEach(() => {
      requiredFields = ['NAME', 'SUMLEVEL', 'GEO_ID']
    })

    describe('nation', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.nation.summaryLevel).toBe('010')
      })

      it('should include the correct required fields', () => {
        expect(SummaryLevels.nation.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })

    describe('region', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.region.summaryLevel).toBe('020')
      })

      it('should include the correct required fields', () => {
        expect(SummaryLevels.region.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })

    describe('division', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.division.summaryLevel).toBe('030')
      })

      it('should include the correct required fields', () => {
        expect(SummaryLevels.division.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })

    describe('state', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.state.summaryLevel).toBe('040')
      })

      it('should include the correct required fields', () => {
        requiredFields.push('INTPTLAT', 'INTPTLON', 'STATE')

        expect(SummaryLevels.state.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })

    describe('county', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.county.summaryLevel).toBe('050')
      })

      it('should include the correct required fields', () => {
        requiredFields.push('INTPTLAT', 'INTPTLON', 'STATE', 'COUNTY')

        expect(SummaryLevels.county.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })

    describe('place', () => {
      it('should include the correct summary level', () => {
        expect(SummaryLevels.place.summaryLevel).toBe('160')
      })

      it('should include the correct required fields', () => {
        requiredFields.push('INTPTLAT', 'INTPTLON', 'STATE')

        expect(SummaryLevels.place.requiredFields).toEqual(
          expect.arrayContaining(requiredFields),
        )
      })
    })
  })
})
