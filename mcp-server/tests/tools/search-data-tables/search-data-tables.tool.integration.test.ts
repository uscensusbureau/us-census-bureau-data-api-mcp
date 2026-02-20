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
    await testClient.query('DELETE FROM data_table_datasets WHERE true')
    await testClient.query('DELETE FROM data_tables WHERE true')
    await testClient.query('DELETE FROM datasets WHERE true')
    await testClient.query('DELETE FROM years WHERE true')
    await testClient.query('DELETE FROM components WHERE true')
    await testClient.query('DELETE FROM programs WHERE true')

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
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS components_id_seq RESTART WITH 1',
    )
    await testClient.query(
      'ALTER SEQUENCE IF EXISTS programs_id_seq RESTART WITH 1',
    )
  })

  beforeEach(async () => {
    tool = new SearchDataTablesTool()

    // Seed programs
    await testClient.query(`
      INSERT INTO programs (name, label)
      VALUES ('ACS', 'American Community Survey')
    `)

    // Seed components
    await testClient.query(`
      INSERT INTO components (name, api_endpoint, program_id)
      VALUES (
        'ACS 1-Year Estimates',
        'acs/acs1',
        (SELECT id FROM programs WHERE name = 'ACS')
      )
    `)

    // Seed years
    await testClient.query(`
      INSERT INTO years (year)
      VALUES (2009), (2010), (2019)
    `)

    // Seed datasets
    await testClient.query(`
      INSERT INTO datasets (dataset_id, name, description, type, year_id, component_id)
      VALUES
        ('ACSDTY2009', 'ACS 1-Year Detailed Tables', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate',
          (SELECT id FROM years WHERE year = 2009),
          (SELECT id FROM components WHERE api_endpoint = 'acs/acs1')),
        ('ACSDTY2010', 'ACS 1-Year Detailed Tables', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate',
          (SELECT id FROM years WHERE year = 2010),
          (SELECT id FROM components WHERE api_endpoint = 'acs/acs1')),
        ('ACSDTY2019', 'ACS 1-Year Detailed Tables', 'The American Community Survey (ACS) is a nationwide survey...', 'aggregate',
          (SELECT id FROM years WHERE year = 2019),
          (SELECT id FROM components WHERE api_endpoint = 'acs/acs1'))
    `)

    // Seed data_tables
    await testClient.query(`
      INSERT INTO data_tables (data_table_id, label)
      VALUES
        ('B16005',  'Nativity By Language Spoken At Home By Ability To Speak English'),
        ('B16005D', 'Nativity By Language Spoken At Home By Ability To Speak English'),
        ('B19001',  'Household Income In The Past 12 Months')
    `)

    // B16005
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

    // B16005D
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

    // B19001
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

    const text = getResponseText(response)

    expect(text).toContain('Found 1 Matching Data Table:')
    expect(text).toContain('B19001')
    expect(text).toContain('Household Income In The Past 12 Months')
  })

  it('returns all tables matching a data_table_id prefix', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })

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

  it('returns only tables belonging to the specified api_endpoint', async () => {
    const response = await tool.handler({ api_endpoint: 'acs/acs1' })

    const text = getResponseText(response)

    expect(text).toContain('Found 3 Matching Data Tables:')
    expect(text).toContain('B16005')
    expect(text).toContain('B16005D')
    expect(text).toContain('B19001')
  })

  it('returns no results for an unknown api_endpoint', async () => {
    const response = await tool.handler({ api_endpoint: 'unknown/endpoint' })

    const text = getResponseText(response)

    expect(text).toBe(
      'No data tables found matching api endpoint "unknown/endpoint".',
    )
  })

  it('returns no results when the label matches but the api_endpoint filter excludes it', async () => {
    const response = await tool.handler({
      label_query: 'household income',
      api_endpoint: 'dec/sf1',
    })

    const text = getResponseText(response)

    expect(text).toContain('No data tables found matching')
    expect(text).toContain('label "household income"')
    expect(text).toContain('api endpoint "dec/sf1"')
  })

  it('includes component and years in each result', async () => {
    const response = await tool.handler({ data_table_id: 'B19001' })

    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const table = parsed[0]
    expect(table.component).toBe('American Community Survey - ACS 1-Year Estimates')
    expect(Array.isArray(table.years)).toBe(true)
    expect(table.years).toContain(2019)
  })

  it('aggregates years across datasets for the same component', async () => {
    const response = await tool.handler({ data_table_id: 'B16005' })

    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const table = parsed.find(
      (t: { data_table_id: string }) => t.data_table_id === 'B16005',
    )
    expect(table.years).toContain(2009)
    expect(table.years).toContain(2010)
  })

  it('respects the limit parameter', async () => {
    const response = await tool.handler({ data_table_id: 'B', limit: 1 })

    const text = getResponseText(response)

    expect(text).toContain('Found 1 Matching Data Table:')
  })
})