import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCitation } from '../../src/helpers/citation'

describe('buildCitation', () => {
  let originalApiKey: string | undefined

  beforeEach(() => {
    // Save the original value
    originalApiKey = process.env.CENSUS_API_KEY
  })

  afterEach(() => {
    // Restore the original value
    if (originalApiKey !== undefined) {
      process.env.CENSUS_API_KEY = originalApiKey
    } else {
      delete process.env.CENSUS_API_KEY
    }
  })

  it('should return a citation with the URL when API key is not set', () => {
    process.env.CENSUS_API_KEY = ''
    const url = 'https://api.census.gov/data/2020/acs/acs5'
    const citation = buildCitation(url)
    expect(citation).toBe(`Source: U.S. Census Bureau Data API (${url})`)
  })

  it('should return a citation with the URL and redacted API key when API key is set', () => {
    process.env.CENSUS_API_KEY = 'test-api-key'
    const url = 'https://api.census.gov/data/2020/acs/acs5?key=test-api-key'
    const citation = buildCitation(url)
    expect(citation).toBe(
      `Source: U.S. Census Bureau Data API (https://api.census.gov/data/2020/acs/acs5?key=REDACTED)`,
    )
  })
})
