/**
 * Integration tests for ResolveGeographyFipsTool using the bundled SQLite database.
 * No Docker or Postgres required.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { DatabaseService } from '../../../src/services/database.service'
import { ResolveGeographyFipsTool } from '../../../src/tools/resolve-geography-fips.tool'

function getResponseText(
  response: Awaited<ReturnType<ResolveGeographyFipsTool['handler']>>,
): string {
  const item = response.content[0]
  if (item.type !== 'text') throw new Error(`Expected text, got "${item.type}"`)
  return (item as { type: 'text'; text: string }).text
}

describe('ResolveGeographyFipsTool - Integration Tests', () => {
  let tool: ResolveGeographyFipsTool

  beforeAll(() => {
    ;(DatabaseService as unknown as { instance: unknown }).instance = undefined
    tool = new ResolveGeographyFipsTool()
  })

  it('should return appropriately formatted content from the database', async () => {
    const response = await tool.handler({ geography_name: 'Philadelphia' })
    const text = getResponseText(response)

    expect(text).toContain('Matching Geographies:')
    expect(text).toContain('Philadelphia')
    expect(text).toContain('for_param')
  })

  it('should filter results by summary level when specified', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: 'Place',
    })
    const text = getResponseText(response)

    // Only Place-level results
    expect(text).toContain('Matching Geographies:')
    expect(text).toContain('Place')
    // Should not contain County results
    expect(text).not.toContain('Philadelphia County, Pennsylvania')
  })

  it('should filter by summary level code when provided', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: '160', // Place code
    })
    const text = getResponseText(response)

    expect(text).toContain('Matching Geographies:')
    // Place-level Philadelphias
    expect(text).toContain('Philadelphia')
    expect(text).not.toContain('Philadelphia County')
  })

  it('should return all matching geographies when no summary level filter is provided', async () => {
    const response = await tool.handler({ geography_name: 'Philadelphia' })
    const text = getResponseText(response)

    // Both city and county Philadelphias should appear
    expect(text).toContain('Philadelphia city, Pennsylvania')
    expect(text).toContain('Philadelphia County, Pennsylvania')
  })

  it('should return empty result when filtering by non-matching summary level', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: 'Nation', // No nations named Philadelphia
    })
    const text = getResponseText(response)

    expect(text).toContain('No geographies found matching "Philadelphia".')
  })
})
