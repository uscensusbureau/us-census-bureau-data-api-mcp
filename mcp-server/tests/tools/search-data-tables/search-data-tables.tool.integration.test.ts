/**
 * Integration tests for SearchDataTablesTool using the bundled SQLite database.
 * No Docker or Postgres required.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { DatabaseService } from '../../../src/services/database.service'
import { SearchDataTablesTool } from '../../../src/tools/search-data-tables.tool'
import { DataTableSearchResultRow } from '../../../src/types/data-table.types'

function getResponseText(
  response: Awaited<ReturnType<SearchDataTablesTool['handler']>>,
): string {
  const item = response.content[0]
  if (item.type !== 'text') {
    throw new Error(`Expected text content, got "${item.type}"`)
  }
  return (item as { type: 'text'; text: string }).text
}

describe('SearchDataTablesTool - Integration Tests', () => {
  let tool: SearchDataTablesTool

  beforeAll(() => {
    ;(DatabaseService as unknown as { instance: unknown }).instance = undefined
    tool = new SearchDataTablesTool()
  })

  it('returns the expected table when a full data_table_id is provided', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })
    const text = getResponseText(response)

    expect(text).toContain('Matching Data Table')
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])
    expect(parsed.some((t) => t.data_table_id === 'B16005')).toBe(true)
  })

  it('returns all tables matching a data_table_id prefix', async () => {
    const response = await tool.handler({ data_table_id: 'B01001' })
    const text = getResponseText(response)
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])

    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed.every((t) => t.data_table_id.startsWith('B01001'))).toBe(true)
  })

  it('returns tables matching an income label query', async () => {
    const response = await tool.handler({ label_query: 'median household income' })
    const text = getResponseText(response)
    expect(text).toContain('Matching Data Table')
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('returns tables whose canonical label fuzzy-matches the query', async () => {
    const response = await tool.handler({ label_query: 'language spoken at home' })
    const text = getResponseText(response)
    expect(text).toContain('Matching Data Table')
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('returns multiple tables when a dataset contains them', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })
    const text = getResponseText(response)
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])
    // B16005 family has many variants (A through I etc.)
    expect(parsed.length).toBeGreaterThan(1)
  })

  it('includes year in each dataset entry', async () => {
    const response = await tool.handler({ data_table_id: 'B01001' })
    const text = getResponseText(response)
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])

    expect(parsed[0].datasets.length).toBeGreaterThan(0)
    expect(parsed[0].datasets[0]).toHaveProperty('year')
  })

  it('includes label on dataset entries whose label differs from the canonical table label', async () => {
    // B07410 has datasets whose variant label differs from the canonical table label
    const response = await tool.handler({ data_table_id: 'B07410' })
    const text = getResponseText(response)
    expect(text).toContain('Matching Data Table')
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])

    const table = parsed.find((t) => t.data_table_id === 'B07410')
    expect(table).toBeDefined()
    const hasVariantLabel = table!.datasets.some((ds) => ds.label !== undefined)
    expect(hasVariantLabel).toBe(true)
  })

  it('returns only tables belonging to the specified dataset', async () => {
    const service = DatabaseService.getInstance()
    const tables = service.searchDataTables({ data_table_id: 'B01001' })
    expect(tables.length).toBeGreaterThan(0)
    const dsId = tables[0].datasets[0].dataset_id

    const response = await tool.handler({ dataset_id: dsId })
    const text = getResponseText(response)
    const parsed: DataTableSearchResultRow[] = JSON.parse(text.split('\n\n')[1])

    expect(parsed.length).toBeGreaterThan(0)
    parsed.forEach((t) => {
      const belongsToDataset = t.datasets.some((ds) => ds.dataset_id === dsId)
      expect(belongsToDataset).toBe(true)
    })
  })

  it('searches variant labels when a dataset_id is provided', async () => {
    const service = DatabaseService.getInstance()
    // B07410 has variant dataset labels; use its first dataset_id as the scope
    const tables = service.searchDataTables({ data_table_id: 'B07410' })
    expect(tables.length).toBeGreaterThan(0)
    const dsId = tables[0].datasets[0].dataset_id

    const response = await tool.handler({
      dataset_id: dsId,
      label_query: 'geographical mobility',
    })
    const text = getResponseText(response)
    expect(text).toContain('Matching Data Table')
  })
})
