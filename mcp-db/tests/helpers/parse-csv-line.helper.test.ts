import { describe, it, expect } from 'vitest'
import { parseCSVLine } from '../../src/helpers/parse-csv-line.helper'

describe('parseCSVLine', () => {
  it('parses simple CSV line', () => {
    const result = parseCSVLine('"ABSCB2017","Demographics"')
    expect(result).toEqual(['ABSCB2017', 'Demographics'])
  })

  it('parses CSV line with commas in quoted field', () => {
    const result = parseCSVLine('"ABSCB2017","Demographics, Income, Housing"')
    expect(result).toEqual(['ABSCB2017', 'Demographics, Income, Housing'])
  })

  it('parses CSV line with many commas', () => {
    const result = parseCSVLine(
      '"DECENNIALDPSF42000","Age_and_Sex, Ancestry, Children"',
    )
    expect(result).toEqual([
      'DECENNIALDPSF42000',
      'Age_and_Sex, Ancestry, Children',
    ])
  })

  it('handles empty quoted fields', () => {
    const result = parseCSVLine('"ABSCB2017",""')
    expect(result).toEqual(['ABSCB2017', ''])
  })

  it('handles single field', () => {
    const result = parseCSVLine('"ABSCB2017"')
    expect(result).toEqual(['ABSCB2017'])
  })

  it('handles three fields', () => {
    const result = parseCSVLine('"field1","field2","field3"')
    expect(result).toEqual(['field1', 'field2', 'field3'])
  })

  it('returns array with empty string', () => {
    const result = parseCSVLine('')
    expect(result).toEqual([''])
  })
})
