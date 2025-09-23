import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { RefinementCtx, z } from 'zod'

import {
  datasetValidator,
  validateGeographyArgs,
} from '../../src/schema/validators'

type TableArgs = {
  for?: string
  ucgid?: string
}

describe('datasetValidator', () => {
  it('returns the correct tool name', () => {
    const datasets = [
      'acs/acs1',
      'timeseries/eits',
      'acs/acs1/pums',
      'acs/acs1/subject',
      'unknown/data',
    ]

    expect(datasetValidator(datasets[0]).tool).toBe('fetch-aggregate-data')
    expect(datasetValidator(datasets[1]).tool).toBe('fetch-timeseries-data')
    expect(datasetValidator(datasets[2]).tool).toBe('fetch-microdata')
    expect(datasetValidator(datasets[3]).tool).toBe('fetch-aggregate-data')
    expect(datasetValidator(datasets[4]).tool).toBe('fetch-aggregate-data')
  })
})

describe('validateGeographyArgs', () => {
  let mockCtx: RefinementCtx
  let addIssueSpy: vi.SpyInstance

  beforeEach(() => {
    // Create a mock RefinementCtx
    addIssueSpy = vi.fn()
    mockCtx = {
      addIssue: addIssueSpy,
    } as unknown as RefinementCtx
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('when neither for nor ucgid is provided', () => {
    it('should add an issue for missing geography', () => {
      const args: TableArgs = {}

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).toHaveBeenCalledTimes(1)
      expect(addIssueSpy).toHaveBeenCalledWith({
        path: ['for', 'ucgid'],
        code: z.ZodIssueCode.custom,
        message:
          'No geography specified error - define for or ucgid arguments.',
      })
    })

    it('should add an issue when for is undefined and ucgid is undefined', () => {
      const args: TableArgs = {}

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).toHaveBeenCalledTimes(1)
      expect(addIssueSpy).toHaveBeenCalledWith({
        path: ['for', 'ucgid'],
        code: z.ZodIssueCode.custom,
        message:
          'No geography specified error - define for or ucgid arguments.',
      })
    })
  })

  describe('when both for and ucgid are provided', () => {
    it('should add an issue for too many geographies', () => {
      const args: TableArgs = {
        for: 'state:01',
        ucgid: '0400000US01',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).toHaveBeenCalledTimes(1)
      expect(addIssueSpy).toHaveBeenCalledWith({
        path: ['for', 'ucgid'],
        code: z.ZodIssueCode.custom,
        message:
          'Too many geographies specified error - define for or ucgid only, not both.',
      })
    })

    it('should add an issue even when values are empty strings', () => {
      const args: TableArgs = {
        for: '',
        ucgid: '',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).toHaveBeenCalledTimes(1)
      expect(addIssueSpy).toHaveBeenCalledWith({
        path: ['for', 'ucgid'],
        code: z.ZodIssueCode.custom,
        message:
          'No geography specified error - define for or ucgid arguments.',
      })
    })
  })

  describe('when only for is provided', () => {
    it('should not add any issues', () => {
      const args: TableArgs = {
        for: 'state:01',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).not.toHaveBeenCalled()
    })

    it('should not add issues when for is provided and ucgid is undefined', () => {
      const args: TableArgs = {
        for: 'county:*',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).not.toHaveBeenCalled()
    })
  })

  describe('when only ucgid is provided', () => {
    it('should not add any issues', () => {
      const args: TableArgs = {
        ucgid: '0400000US01',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).not.toHaveBeenCalled()
    })

    it('should not add issues when ucgid is provided and for is undefined', () => {
      const args: TableArgs = {
        ucgid: '0400000US01',
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should treat empty string as undefined for validation purposes', () => {
      // Test that empty strings are considered "provided" values
      const argsWithEmptyFor: TableArgs = {
        for: '',
      }

      validateGeographyArgs(argsWithEmptyFor, mockCtx)

      expect(addIssueSpy).toHaveBeenCalled()

      // Reset mock
      addIssueSpy.mockClear()

      const argsWithEmptyUcgid: TableArgs = {
        ucgid: '',
      }

      validateGeographyArgs(argsWithEmptyUcgid, mockCtx)

      expect(addIssueSpy).toHaveBeenCalled()
    })

    it('should handle null values as falsy', () => {
      const args: TableArgs = {
        for: null as string,
        ucgid: null as string,
      }

      validateGeographyArgs(args, mockCtx)

      expect(addIssueSpy).toHaveBeenCalledTimes(1)
      expect(addIssueSpy).toHaveBeenCalledWith({
        path: ['for', 'ucgid'],
        code: z.ZodIssueCode.custom,
        message:
          'No geography specified error - define for or ucgid arguments.',
      })
    })
  })
})
