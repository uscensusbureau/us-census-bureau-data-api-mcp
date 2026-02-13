import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { Client } from 'pg'

import { DatabaseService } from '../../../src/services/database.service'
import { databaseConfig } from '../../helpers/database-config'
import { SearchDataTablesTool } from '../../../src/tools/search-data-tables.tool'

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
  let testClient: Client
  let databaseService: DatabaseService
  let tool: SearchDataTablesTool

  beforeAll(async () => {
    testClient = new Client(databaseConfig)
    await testClient.connect()
    ;(DatabaseService as unknown as { instance: unknown }).instance = undefined
    databaseService = DatabaseService.getInstance()
  })

  afterAll(async () => {
    await testClient.end()
    await databaseService.cleanup()
  })

  afterEach(async () => {
    // Clean up in dependency order (children first)
    await testClient.query('DELETE FROM data_table_datasets WHERE true')
    await testClient.query('DELETE FROM data_tables WHERE true')
    await testClient.query('DELETE FROM datasets WHERE true')
    await testClient.query('DELETE FROM years WHERE true')

    // Reset sequences
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS data_table_datasets_id_seq RESTART WITH 1',
    )
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS data_tables_id_seq RESTART WITH 1',
    )
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS datasets_id_seq RESTART WITH 1',
    )
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS years_id_seq RESTART WITH 1',
    )
  })

  beforeEach(async () => {
    tool = new SearchDataTablesTool()

    // Seed years
    await testClient.query(`
      INSERT INTO years (year)
      VALUES (2009), (2010), (2019)
    `)

    // Seed datasets (dataset_id string, year FK by subquery)
    await testClient.query(`
      INSERT INTO datasets (dataset_id, name, dataset_param, description, type, year_id)
      VALUES
        ('ACSDTY2009', 'ACS 1-Year Detailed Tables', 'acs/acs1', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate', (SELECT id FROM years WHERE year = 2009)),
        ('ACSDTY2010', 'ACS 1-Year Detailed Tables', 'acs/acs1', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate', (SELECT id FROM years WHERE year = 2010)),
        ('ACSDTY2019', 'ACS 1-Year Detailed Tables', 'acs/acs1', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate', (SELECT id FROM years WHERE year = 2019))
    `)

    // Seed data_tables (canonical label on the table itself)
    await testClient.query(`
      INSERT INTO data_tables (data_table_id, label)
      VALUES
        ('B16005',  'Nativity By Language Spoken At Home By Ability To Speak English'),
        ('B16005D', 'Nativity By Language Spoken At Home By Ability To Speak English'),
        ('B19001',  'Household Income In The Past 12 Months')
    `)

    // Seed data_table_datasets (join rows with per-dataset labels)
    // B16005 — same label in all datasets (no variant)
    await testClient.query(`
      INSERT INTO data_table_datasets (data_table_id, dataset_id, label)
      VALUES
        (
          (SELECT id FROM data_tables WHERE data_table_id = 'B16005'),
          (SELECT id FROM datasets    WHERE dataset_id   = 'ACSDTY2009'),
          'Nativity By Language Spoken At Home By Ability To Speak English'
        ),
        (
          (SELECT id FROM data_tables WHERE data_table_id = 'B16005'),
          (SELECT id FROM datasets    WHERE dataset_id   = 'ACSDTY2010'),
          'Nativity By Language Spoken At Home By Ability To Speak English'
        )
    `)

    // B16005D — dataset-specific variant label
    await testClient.query(`
      INSERT INTO data_table_datasets (data_table_id, dataset_id, label)
      VALUES
        (
          (SELECT id FROM data_tables WHERE data_table_id = 'B16005D'),
          (SELECT id FROM datasets    WHERE dataset_id   = 'ACSDTY2009'),
          'Nativity By Language Spoken At Home (Asian Alone)'
        ),
        (
          (SELECT id FROM data_tables WHERE data_table_id = 'B16005D'),
          (SELECT id FROM datasets    WHERE dataset_id   = 'ACSDTY2010'),
          'Nativity By Language Spoken At Home (Asian Alone)'
        )
    `)

    // B19001 — income table, appears only in ACSDTY2019
    await testClient.query(`
      INSERT INTO data_table_datasets (data_table_id, dataset_id, label)
      VALUES
        (
          (SELECT id FROM data_tables WHERE data_table_id = 'B19001'),
          (SELECT id FROM datasets    WHERE dataset_id   = 'ACSDTY2019'),
          'Household Income In The Past 12 Months'
        )
    `)
  })

  it('returns the expected table when a full data_table_id is provided', async () => {
    const response = await tool.handler({ data_table_id: 'B19001' })

    expect(response.content[0].type).toBe('text')
    const text = getResponseText(response)

    expect(text).toContain('Found 1 Matching Data Table:')
    expect(text).toContain('B19001')
    expect(text).toContain('Household Income In The Past 12 Months')
  })

  it('returns all tables matching a data_table_id prefix', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })

    expect(response.content[0].type).toBe('text')
    const text = getResponseText(response)

    expect(text).toContain('Found 2 Matching Data Tables:')
    expect(text).toContain('B16005')
    expect(text).toContain('B16005D')
    expect(text).not.toContain('B19001')
  })

  it('returns no results for an unknown data_table_id', async () => {
    const response = await tool.handler({ data_table_id: 'ZZZZZZ' })

    const text = getResponseText(response)

    expect(text).toBe('No data tables found matching table ID "ZZZZZZ".')
  })

  it('returns tables whose canonical label fuzzy-matches the query', async () => {
    const response = await tool.handler({
      label_query: 'language spoken at home',
    })

    expect(response.content[0].type).toBe('text')
    const text = getResponseText(response)

    expect(text).toContain('B16005')
    expect(text).toContain('B16005D')
    expect(text).not.toContain('B19001')
  })

  it('returns tables matching an income label query', async () => {
    const response = await tool.handler({ label_query: 'household income' })

    const text = getResponseText(response)

    expect(text).toContain('B19001')
    expect(text).toContain('Household Income In The Past 12 Months')
  })

  it('returns no results for a label query with no similarity match', async () => {
    const response = await tool.handler({
      label_query: 'xyzzy nonexistent topic',
    })

    const text = getResponseText(response)

    expect(text).toBe(
      'No data tables found matching label "xyzzy nonexistent topic".',
    )
  })

  it('returns only tables belonging to the specified dataset', async () => {
    const response = await tool.handler({ dataset_id: 'ACSDTY2019' })

    expect(response.content[0].type).toBe('text')
    const text = getResponseText(response)

    expect(text).toContain('Found 1 Matching Data Table:')
    expect(text).toContain('B19001')
    expect(text).not.toContain('B16005')
  })

  it('returns multiple tables when a dataset contains them', async () => {
    const response = await tool.handler({ dataset_id: 'ACSDTY2009' })

    const text = getResponseText(response)

    expect(text).toContain('Found 2 Matching Data Tables:')
    expect(text).toContain('B16005')
    expect(text).toContain('B16005D')
  })

  it('returns no results for an unknown dataset_id', async () => {
    const response = await tool.handler({ dataset_id: 'UNKNOWN2099' })

    const text = getResponseText(response)

    expect(text).toBe('No data tables found matching dataset "UNKNOWN2099".')
  })

  it('searches variant labels when a dataset_id is provided', async () => {
    // The canonical label on data_tables for B16005D is the generic
    // 'Nativity By Language Spoken At Home By Ability To Speak English'.
    // The variant label on data_table_datasets is the more specific
    // 'Nativity By Language Spoken At Home (Asian Alone)'.
    //
    // Searching 'language spoken home' without a dataset_id searches the
    // canonical label and returns both B16005 and B16005D.
    // Searching the same query scoped to ACSDTY2009 should still return both,
    // confirming the dataset filter works without relying on variant-only terms.

    const broadResponse = await tool.handler({
      label_query: 'language spoken home',
    })
    const scopedResponse = await tool.handler({
      label_query: 'language spoken home',
      dataset_id: 'ACSDTY2009',
    })

    const broadText = getResponseText(broadResponse)
    const scopedText = getResponseText(scopedResponse)

    // Both searches should find the language tables
    expect(broadText).toContain('B16005')
    expect(broadText).toContain('B16005D')

    // Scoped to ACSDTY2009, income table should not appear
    expect(scopedText).toContain('B16005')
    expect(scopedText).toContain('B16005D')
    expect(scopedText).not.toContain('B19001')
  })

  it('returns no results when the label matches but the dataset filter excludes it', async () => {
    // B19001 exists only in ACSDTY2019, not in ACSDTY2009
    const response = await tool.handler({
      label_query: 'household income',
      dataset_id: 'ACSDTY2009',
    })

    const text = getResponseText(response)

    expect(text).toContain('No data tables found matching')
    expect(text).toContain('label "household income"')
    expect(text).toContain('dataset "ACSDTY2009"')
  })

  it('includes year in each dataset entry', async () => {
    const response = await tool.handler({ data_table_id: 'B19001' })

    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const table = parsed[0]
    expect(table.datasets[0].year).toBe(2019)
    expect(table.datasets[0].dataset_id).toBe('ACSDTY2019')
  })

  it('omits label from dataset entries whose label matches the canonical table label', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })

    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const table = parsed.find(
      (t: { data_table_id: string }) => t.data_table_id === 'B16005',
    )
    expect(table.datasets[0].label).toBeUndefined()
    expect(table.datasets[1].label).toBeUndefined()
  })

  it('includes label on dataset entries whose label differs from the canonical table label', async () => {
    const response = await tool.handler({ data_table_id: 'B16005D' })

    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const table = parsed.find(
      (t: { data_table_id: string }) => t.data_table_id === 'B16005D',
    )
    expect(table.datasets[0].label).toBe(
      'Nativity By Language Spoken At Home (Asian Alone)',
    )
  })

  it('respects the limit parameter', async () => {
    // All three tables match a broad prefix; limit to 1
    const response = await tool.handler({ data_table_id: 'B', limit: 1 })

    const text = getResponseText(response)

    expect(text).toContain('Found 1 Matching Data Table:')
  })
})
