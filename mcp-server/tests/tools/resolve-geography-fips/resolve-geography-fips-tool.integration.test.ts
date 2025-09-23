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
        ('Place', 'Census-designated places that meet population requirements', 'PLACE', 'place', false, '160 ', '040')
    `)

    await testClient.query(`
      INSERT INTO geographies (name, summary_level_code, ucgid_code, latitude, longitude, state_code, county_code, for_param, in_param)
      VALUES 
        ('United States','010','0100000US','34.7366771','-103.2852703', null, null, 'us:*', null),
        ('Pennsylvania','040','0400000US42','40.5869403','-77.3684875', '42', null, 'state:42', null),
        ('Philadelphia city, Pennsylvania','160','1600000US4260000','40.0093755','-75.1333459', '42', null, 'place:60000', 'state:42')
    `)
  })

  it('should return appropriately formatted content from the database', async () => {
    const response = await tool.handler({
      geography_name: 'Philadelphia',
    })

    expect(response.content[0].type).toBe('text')
    const responseText = response.content[0].text

    expect(responseText).toContain('Found 1 Matching Geographies:')
    expect(responseText).toContain('Philadelphia city, Pennsylvania')
    expect(responseText).toContain('"for_param": "place:60000')
    expect(responseText).toContain('"in_param": "state:42"')
  })
})
