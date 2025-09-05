import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest'
import { Client } from 'pg'
import { FetchDatasetGeographyTool } from '../../../src/tools/fetch-dataset-geography.tool.js'
import { DatabaseService } from '../../../src/services/database.service.js'
import { databaseConfig } from '../../helpers/database-config.js'

describe('FetchDatasetGeographyTool - Integration Tests', () => {
  let testClient: Client
  let databaseService: DatabaseService
  let tool: FetchDatasetGeographyTool

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
      await testClient.query('DELETE FROM summary_levels WHERE true')

      // Reset sequences
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
    tool = new FetchDatasetGeographyTool()

    // Insert known test data
    await testClient.query(`
      INSERT INTO summary_levels (name, description, get_variable, query_name, on_spine, code, parent_summary_level)
      VALUES 
        ('United States', 'United States total', 'NATION', 'us', true, '010', null),
        ('State', 'States and State equivalents', 'STATE', 'state', true, '040', '010'),
        ('County', 'Counties and county equivalents', 'COUNTY', 'county', true, '050', '040'),
        ('Congressional District', 'Congressional Districts', 'CD', 'congressional+district', true, '500', '040'),
        ('Urban Area', 'Urban Areas', 'URBAN_AREA', 'urban+area', false, '400', null)
    `)

    // Set up parent relationships
    await testClient.query(`
      UPDATE summary_levels 
      SET parent_summary_level_id = (
        SELECT id FROM summary_levels parent 
        WHERE parent.code = summary_levels.parent_summary_level
      )
      WHERE parent_summary_level IS NOT NULL;
    `)
  })

  describe('Real Database Integration', () => {
    it('should successfully connect to database and retrieve geography levels', async () => {
      try {
        const isHealthy = await databaseService.healthCheck()
        console.log('Health check result:', isHealthy)

        if (!isHealthy) {
          // Try to get more details about the connection
          console.log(
            'Health check failed, attempting direct connection test...',
          )

          try {
            const testResult = await databaseService.query('SELECT 1 as test')
            console.log('Direct query test result:', testResult)
          } catch (error) {
            console.error('Direct query failed:', error)
          }
        }

        expect(isHealthy).toBe(true)
      } catch (error) {
        console.error('Health check threw an error:', error)
        throw error
      }

      const result = await databaseService.query(`
        SELECT name, query_name, code, on_spine, parent_summary_level
        FROM summary_levels 
        ORDER BY code
      `)

      expect(result.rows).toHaveLength(5) //Geo Levels are Seeded by DB Container
      expect(result.rows[0]).toMatchObject({
        name: 'United States',
        query_name: 'us',
        code: '010',
        on_spine: true,
        parent_summary_level: null,
      })
    })

    it('should handle database connection failures gracefully', async () => {
      // Temporarily break the database connection
      await databaseService.cleanup()

      // Override with invalid connection
      process.env.DATABASE_URL =
        'postgresql://invalid:invalid@localhost:9999/invalid'
      ;(
        DatabaseService as typeof DatabaseService & { instance: unknown }
      ).instance = undefined

      const brokenTool = new FetchDatasetGeographyTool()

      const response = await brokenTool.handler({ dataset: 'acs/acs1' })

      expect(response.content[0].text).toContain('Database connection failed')

      // Restore connection for other tests
      process.env.DATABASE_URL = `postgresql://${databaseConfig.user}:${databaseConfig.password}@${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`
      ;(
        DatabaseService as typeof DatabaseService & { instance: unknown }
      ).instance = undefined
      databaseService = DatabaseService.getInstance()
    })

    it('should handle missing geography levels gracefully', async () => {
      // Mock fetch to return empty FIPS array
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fips: [] }),
      })

      global.fetch = mockFetch

      const response = await tool.handler({ dataset: 'acs/acs1' })

      expect(response.content[0].type).toBe('text')
      const responseText = response.content[0].text

      expect(responseText).toEqual('Geography endpoint returned: 404 ')
    })
  })

  describe('Real Census API Integration', () => {
    it('should fetch real ACS geography metadata with database enhancement', async () => {
      const datasetName = 'acs/acs1'

      const response = await tool.handler({
        dataset: datasetName,
        year: 2022,
      })

      expect(response.content[0].type).toBe('text')
      const responseText = response.content[0].text

      // Basic structure checks
      expect(responseText).toContain(
        'Available geographies for acs/acs1 (2022)',
      )

      // Parse JSON response
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      expect(Array.isArray(parsedData)).toBe(true)
      expect(parsedData.length).toBeGreaterThan(0)

      // Find a geography that should match our database
      const usGeography = parsedData.find((geo) => geo.code === '010')

      if (usGeography) {
        // Verify database values are used
        expect(usGeography).toMatchObject({
          displayName: 'United States',
          querySyntax: 'us',
          onSpine: true,
          description: 'United States total',
        })
      }

      const stateGeography = parsedData.find((geo) => geo.code === '040')
      if (stateGeography) {
        expect(stateGeography).toMatchObject({
          displayName: 'State',
          querySyntax: 'state',
          onSpine: true,
          queryExample: expect.stringContaining('for=state:*'),
        })
      }
    }, 15000) // Extended timeout for real API calls

    it('should handle real API errors gracefully', async () => {
      const response = await tool.handler({
        dataset: 'nonexistent/dataset',
      })

      expect(response.content[0].type).toBe('text')
      expect(response.content[0].text).toContain(
        'Geography endpoint returned: 404',
      )
    }, 10000)

    it('should work with timeseries datasets', async () => {
      const datasetName = 'timeseries/healthins/sahie'

      const response = await tool.handler({
        dataset: datasetName,
      })

      expect(response.content[0].type).toBe('text')
      const responseText = response.content[0].text

      expect(responseText).toContain(
        'Available geographies for timeseries/healthins/sahie',
      )

      // Should be able to parse as JSON
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))
      expect(Array.isArray(parsedData)).toBe(true)
    }, 15000)
  })

  describe('Database-Driven Metadata Enhancement', () => {
    it('should use database values over API values when available', async () => {
      // Mock fetch to return simple API data
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          fips: [
            {
              name: 'us', // API name
              geoLevelDisplay: '010',
              referenceDate: '2022-01-01',
            },
            {
              name: 'state', // API name
              geoLevelDisplay: '040',
              referenceDate: '2022-01-01',
              requires: ['us'],
            },
          ],
        }),
      })

      global.fetch = mockFetch

      const response = await tool.handler({ dataset: 'acs/acs1', year: '2022' })

      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // Verify database values override API values
      const usRecord = parsedData.find((geo) => geo.code === '010')

      expect(usRecord).toMatchObject({
        displayName: 'United States', // From database, not API 'us'
        querySyntax: 'us', // From database query_name
        description: 'United States total', // From database
        onSpine: true, // From database
      })

      const stateRecord = parsedData.find((geo) => geo.code === '040')

      expect(stateRecord).toMatchObject({
        displayName: 'State', // From database, not API 'state'
        querySyntax: 'state', // From database query_name
        queryExample: 'for=state:*', // Built from database hierarchy
        onSpine: true, // From database
      })
    })

    it('should build correct hierarchical query examples', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          fips: [
            { name: 'us', geoLevelDisplay: '010', referenceDate: '2022-01-01' },
            {
              name: 'state',
              geoLevelDisplay: '040',
              referenceDate: '2022-01-01',
              requires: ['us'],
            },
            {
              name: 'county',
              geoLevelDisplay: '050',
              referenceDate: '2022-01-01',
              requires: ['state'],
            },
            {
              name: 'congressional district',
              geoLevelDisplay: '500',
              referenceDate: '2022-01-01',
              requires: ['state'],
            },
          ],
        }),
      })

      global.fetch = mockFetch

      const response = await tool.handler({ dataset: 'acs/acs1', year: '2022' })

      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // Check query examples are built from database hierarchy
      const usRecord = parsedData.find((geo) => geo.code === '010')
      expect(usRecord?.queryExample).toBe('for=us:*')

      const stateRecord = parsedData.find((geo) => geo.code === '040')
      expect(stateRecord?.queryExample).toBe('for=state:*')

      const countyRecord = parsedData.find((geo) => geo.code === '050')
      expect(countyRecord?.queryExample).toBe('for=county:*&in=state:*')

      const congressionalRecord = parsedData.find((geo) => geo.code === '500')
      expect(congressionalRecord?.queryExample).toBe(
        'for=congressional+district:*&in=state:*',
      )
    })

    it('should handle mixed on_spine values from database', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          fips: [
            { name: 'us', geoLevelDisplay: '010', referenceDate: '2022-01-01' },
            {
              name: 'urban area',
              geoLevelDisplay: '400',
              referenceDate: '2022-01-01',
            },
          ],
        }),
      })

      global.fetch = mockFetch

      const response = await tool.handler({ dataset: 'acs/acs1', year: '2022' })

      const responseText = response.content[0].text
      const jsonStart = responseText.indexOf('[')
      const parsedData = JSON.parse(responseText.substring(jsonStart))

      // US should be on spine
      const usRecord = parsedData.find((geo) => geo.code === '010')
      expect(usRecord?.onSpine).toBe(true)

      // Urban Area should not be on spine (based on our test data)
      const urbanRecord = parsedData.find((geo) => geo.code === '400')
      expect(urbanRecord?.onSpine).toBe(false) // Fixed: was usRecord instead of urbanRecord
    })
  })
})
