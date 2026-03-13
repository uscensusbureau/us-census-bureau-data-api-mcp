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
import { getResponseText } from '../../helpers/get-response-text.js'
import { ListSurveyProgramsTool } from '../../../src/tools/list-survey-programs.tool'

describe('ListSurveyProgramsTool - Integration Tests', () => {
  let testClient: Client
  let databaseService: DatabaseService
  let tool: ListSurveyProgramsTool

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
    tool = new ListSurveyProgramsTool()

    await testClient.query(`
      INSERT INTO programs (acronym, label, description)
      VALUES
        ('ACS', 'American Community Survey', 'Ongoing survey providing annual demographic, social, economic, and housing data.'),
        ('ECN', 'Economic Census', 'Official five-year measure of American business and the economy.')
    `)

    await testClient.query(`
      INSERT INTO components (label, api_endpoint, description, component_id, program_id)
      VALUES (
        'ACS 1-Year Estimates',
        'acs/acs1',
        'ACS 1-Year Estimates',
        'ACS1',
        (SELECT id FROM programs WHERE acronym = 'ACS')
      )
    `)

    await testClient.query(`
      INSERT INTO years (year) VALUES (2022)
    `)

    await testClient.query(`
      INSERT INTO datasets (dataset_id, name, description, type, api_endpoint, year_id, component_id)
      VALUES (
        'ACSY2022',
        'ACS 1-Year 2022',
        'ACS 1-Year Detailed Tables 2022',
        'aggregate',
        'acs/acs1',
        (SELECT id FROM years WHERE year = 2022),
        (SELECT id FROM components WHERE api_endpoint = 'acs/acs1')
      )
    `)

    await testClient.query(`
      INSERT INTO data_tables (data_table_id, label)
      VALUES ('B01001', 'Sex By Age')
    `)

    await testClient.query(`
      INSERT INTO data_table_datasets (data_table_id, dataset_id, label)
      VALUES (
        (SELECT id FROM data_tables WHERE data_table_id = 'B01001'),
        (SELECT id FROM datasets WHERE dataset_id = 'ACSY2022'),
        'Sex By Age'
      )
    `)
  })

  it('returns all seeded programs', async () => {
    const response = await tool.handler({})
    const text = getResponseText(response)

    expect(text).toContain('Found 2 Survey Programs:')
    expect(text).toContain('American Community Survey')
    expect(text).toContain('Economic Census')
  })

  it('returns programs ordered alphabetically by label', async () => {
    const response = await tool.handler({})
    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const labels = parsed.map((p: { program_label: string }) => p.program_label)
    expect(labels).toEqual([...labels].sort())
  })

  it('reflects correct table_count for a program with indexed tables', async () => {
    const response = await tool.handler({})
    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const acs = parsed.find((p: { program_string: string }) => p.program_string === 'ACS')
    expect(acs.table_count).toBe(1)
  })

  it('reflects table_count of 0 for a program with no indexed tables', async () => {
    const response = await tool.handler({})
    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const ecn = parsed.find((p: { program_string: string }) => p.program_string === 'ECN')
    expect(ecn.table_count).toBe(0)
  })

  it('includes description for programs with an explicit description', async () => {
    const response = await tool.handler({})
    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const acs = parsed.find((p: { program_string: string }) => p.program_string === 'ACS')
    expect(acs.description).toBe(
      'Ongoing survey providing annual demographic, social, economic, and housing data.',
    )
  })

  it('falls back to component description when program description is absent', async () => {
    // Seed a program with no description but a component that has one
    await testClient.query(`
      INSERT INTO programs (acronym, label)
      VALUES ('CPS', 'Current Population Survey')
    `)
    await testClient.query(`
      INSERT INTO components (label, api_endpoint, description, component_id, program_id)
      VALUES (
        'CPS Basic Monthly',
        'cps/basic/nov',
        'Monthly survey of households conducted for the Bureau of Labor Statistics.',
        'CPSBASIC',
        (SELECT id FROM programs WHERE acronym = 'CPS')
      )
    `)

    const response = await tool.handler({})
    const text = getResponseText(response)
    const parsed = JSON.parse(text.split('\n\n')[1])

    const cps = parsed.find((p: { program_string: string }) => p.program_string === 'CPS')
    expect(cps.description).toBe(
      'Monthly survey of households conducted for the Bureau of Labor Statistics.',
    )
  })

  it('returns a no-results message when the programs table is empty', async () => {
    // Clear all data seeded in beforeEach
    await testClient.query('DELETE FROM data_table_datasets WHERE true')
    await testClient.query('DELETE FROM data_tables WHERE true')
    await testClient.query('DELETE FROM datasets WHERE true')
    await testClient.query('DELETE FROM years WHERE true')
    await testClient.query('DELETE FROM components WHERE true')
    await testClient.query('DELETE FROM programs WHERE true')

    const response = await tool.handler({})
    const text = getResponseText(response)

    expect(text).toBe('No survey programs found.')
  })
})