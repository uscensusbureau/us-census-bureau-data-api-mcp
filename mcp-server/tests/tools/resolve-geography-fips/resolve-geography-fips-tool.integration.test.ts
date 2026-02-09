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
import { ResolveGeographyFipsTool } from '../../../src/tools/resolve-geography-fips.tool'

describe('ResolveGeographyFipsTool - Integration Tests', () => {
  let testClient: Client
  let databaseService: DatabaseService
  let tool: ResolveGeographyFipsTool

  beforeAll(async () => {
    // Use test database
    testClient = new Client(databaseConfig)
    await testClient.connect()
    ;(
      DatabaseService as typeof DatabaseService & { instance: unknown }
    ).instance = undefined
    databaseService = DatabaseService.getInstance()
  })

  afterAll(async () => {
    await testClient.end()
    await databaseService.cleanup()
  })

  afterEach(async () => {
    // Clean up test data after each test
    try {
      console.log('Starting cleanup...')

      // Clean up in correct dependency order (children first)
      await testClient.query('DELETE FROM geographies WHERE true')
      await testClient.query('DELETE FROM summary_levels WHERE true')

      // Reset sequences
      await testClient.query(
        'ALTER SEQUENCE IF EXISTS geographies_id_seq RESTART WITH 1',
      )
      await testClient.query(
        'ALTER SEQUENCE IF EXISTS summary_levels_id_seq RESTART WITH 1',
      )

      console.log('Cleanup completed successfully')
    } catch (error) {
      console.error('Cleanup failed:', error)
      throw error
    }
  })

  beforeEach(async () => {
    tool = new ResolveGeographyFipsTool()

    // Insert known test data
    await testClient.query(`
      INSERT INTO summary_levels (name, description, get_variable, query_name, on_spine, code, parent_summary_level)
      VALUES 
        ('Nation', 'The United States', 'NATION', 'us', true, '010', null),
        ('State', 'States and State equivalents', 'STATE', 'state', true, '040', '030'),
        ('County', 'Counties and county equivalents', 'COUNTY', 'county', true, '050', '040'),
        ('Place', 'Census-designated places that meet population requirements', 'PLACE', 'place', false, '160', '040')
    `)

    await testClient.query(`
      INSERT INTO geographies (name, summary_level_code, ucgid_code, latitude, longitude, state_code, county_code, for_param, in_param)
      VALUES 
        ('United States','010','0100000US','34.7366771','-103.2852703', null, null, 'us:*', null),
        ('Pennsylvania','040','0400000US42','40.5869403','-77.3684875', '42', null, 'state:42', null),
        ('Philadelphia County, Pennsylvania','050','0500000US42101','39.9525839','-75.1652215', '42', '101', 'county:101', 'state:42'),
        ('Philadelphia city, Pennsylvania','160','1600000US4260000','40.0093755','-75.1333459', '42', null, 'place:60000', 'state:42')
    `)
  })

  it('should return appropriately formatted content from the database', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    expect(responseText).toContain('Found 2 Matching Geographies:')
    expect(responseText).toContain('Philadelphia city, Pennsylvania')
    expect(responseText).toContain('"for_param": "place:60000')
    expect(responseText).toContain('"in_param": "state:42"')
  })

  it('should filter results by summary level when specified', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: 'Place', // Filter to only Places
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    expect(responseText).toContain('Found 1 Matching Geographies:')
    expect(responseText).toContain('Philadelphia city, Pennsylvania')
    expect(responseText).toContain('Place') // Summary level name

    expect(responseText).not.toContain('Philadelphia County, Pennsylvania')
    expect(responseText).not.toContain('County')
  })

  it('should return only Counties when filtering by County summary level', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: 'County',
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    // Should only return the County, not the Place
    expect(responseText).toContain('Found 1 Matching Geographies:')
    expect(responseText).toContain('Philadelphia County, Pennsylvania')
    expect(responseText).toContain('County')

    // Should NOT contain the Place
    expect(responseText).not.toContain('Philadelphia city, Pennsylvania')
    expect(responseText).not.toContain('Place')
  })

  it('should filter by summary level code when provided', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: '160', // Place code
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    expect(responseText).toContain('Found 1 Matching Geographies:')
    expect(responseText).toContain('Philadelphia city, Pennsylvania')
    expect(responseText).not.toContain('Philadelphia County, Pennsylvania')
  })

  it('should return all matching geographies when no summary level filter is provided', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      // No summary_level filter
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    // Should return both County and Place
    expect(responseText).toContain('Found 2 Matching Geographies:')
    expect(responseText).toContain('Philadelphia County, Pennsylvania')
    expect(responseText).toContain('Philadelphia city, Pennsylvania')
  })

  it('should return empty result when filtering by non-matching summary level', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
      summary_level: 'State', // No States named Philadelphia
    })

    expect(response.content[0].type).toBe('text')
    const content = response.content[0]
    expect(content.type === 'text').toBe(true)
    const responseText = (content as { text: string }).text

    expect(responseText).toContain(
      'No geographies found matching "Philadelphia".',
    )
  })
})
