import { describe, expect, it } from 'vitest'
import {
  BaseSeedConfigSchema,
  GeographyContext,
  GeographyContextSchema,
  GeographySeedConfig,
  GeographySeedConfigSchema,
  SeedConfig,
  validateSeedConfigConstraints,
} from '../../src/schema/seed-config.schema'

describe('BaseSeedConfigSchema', () => {
  it('should succeed when validated with base schema', async () => {
    const config = {
      table: 'summary_levels',
      dataPath: 'summary_levels',
      conflictColumn: 'id',
    }

    const result = BaseSeedConfigSchema.safeParse(config)

    expect(result.success).toBe(true)
  })

  it('should throw error when conflictColumn is missing', async () => {
    const config = {
      file: 'test.json',
      table: 'summary_levels',
      dataPath: 'summary_levels',
      // conflictColumn is missing
    }

    const result = BaseSeedConfigSchema.safeParse(config)

    expect(result.success).toBe(false)

    if (!result.success) {
      const conflictColumnError = result.error.issues.find((issue) =>
        issue.path.includes('conflictColumn'),
      )

      expect(conflictColumnError).toBeDefined()
      expect(conflictColumnError?.code).toBe('invalid_type')
      expect(conflictColumnError?.path).toEqual(['conflictColumn'])
      expect(conflictColumnError?.expected).toBe('string')
      // Remove the exact message check as it may vary between Zod versions
    }
  })
})

describe('SeedConfig', () => {
  it('should reject config with both file and url', () => {
    const config: SeedConfig = {
      file: 'test.json',
      url: 'https://api.example.com/data',
      table: 'test_table',
      conflictColumn: 'id',
    }

    expect(() => validateSeedConfigConstraints(config)).toThrow(
      "Cannot specify both 'file' and 'url'",
    )
  })

  it('should reject config with neither file nor url', () => {
    const config: SeedConfig = {
      table: 'test_table',
      conflictColumn: 'id',
      // No file or url
    }

    expect(() => validateSeedConfigConstraints(config)).toThrow(
      "Either 'file' or 'url' must be provided",
    )
  })

  it('should accept config with only file', () => {
    const config: SeedConfig = {
      file: 'test.json',
      table: 'test_table',
      conflictColumn: 'id',
    }

    expect(() => validateSeedConfigConstraints(config)).not.toThrow()
  })

  it('should accept config with only static url string', () => {
    const config: SeedConfig = {
      url: 'https://api.example.com/data',
      table: 'test_table',
      conflictColumn: 'id',
    }

    expect(() => validateSeedConfigConstraints(config)).not.toThrow()
  })
})

describe('GeographyContextSchema', () => {
  it('should accept valid geography records', () => {
    const GeographyContext = {
      year: 2023,
      year_id: 1,
      parentGeographies: {
        states: [
          {
            name: 'Alabama',
            ucgid_code: '0400000US01',
            geo_id: '0400000US01',
            summary_level_code: '040',
            for_param: 'state:*', // Fixed: should be 'state:*', not 'state:01'
            in_param: null,
            year: 2023,
            intptlat: 32.31823,
            intptlon: -86.902298,
          },
        ],
      },
    }

    const result = GeographyContextSchema.safeParse(GeographyContext)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.parentGeographies?.states?.[0].name).toBe('Alabama')
    }
  })

  it('should return false on empty definitions', () => {
    const GeographyContext = {}

    const result = GeographyContextSchema.safeParse(GeographyContext)

    expect(result.success).toBe(false)
  })

  it('should reject invalid geography records', () => {
    const GeographyContext = {
      parentGeographies: {
        states: [
          {
            name: 'Alabama',
            // Missing required fields
          },
        ],
      },
    }

    const result = GeographyContextSchema.safeParse(GeographyContext)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0)
      // Check that some required field is missing
      expect(
        result.error.issues.some((issue) => issue.code === 'invalid_type'),
      ).toBe(true)
    }
  })

  it('should validate year constraints', () => {
    const GeographyContext = {
      year: 1775, // Before 1776 Fails. 'merica 🇺🇸
      year_id: 1,
    }

    const result = GeographyContextSchema.safeParse(GeographyContext)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.path.includes('year') && issue.code === 'too_small',
        ),
      ).toBe(true)
    }
  })

  it('should be successful with required arguments', () => {
    const GeographyContext = {
      year: 2023,
      year_id: 1,
    }

    const result = GeographyContextSchema.safeParse(GeographyContext)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.year).toBe(2023)
      expect(result.data.parentGeographies).toBeUndefined()
    }
  })
})

describe('GeographySeedConfig', () => {
  it('should be successful with required arguments', () => {
    const config: GeographySeedConfig = {
      url: (context: GeographyContext) =>
        `https://www.census.gov/data/${context.year}`,
      table: 'summary_levels',
      dataPath: 'summary_levels',
      conflictColumn: 'id',
    }

    const zodResult = GeographySeedConfigSchema.safeParse(config)
    expect(zodResult.success).toBe(true)

    // Then validate the constraints
    expect(() => validateSeedConfigConstraints(config)).not.toThrow()
  })
})
