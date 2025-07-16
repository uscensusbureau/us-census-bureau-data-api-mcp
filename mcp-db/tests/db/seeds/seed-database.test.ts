import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { dbConfig } from '../../helpers/database-config';
import { GeographyLevel} from '../../../src/schema/geography-level.schema';
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GeographyLevelRow extends GeographyLevel {
  id: number;
  parent_geography_level_id: number | null;
  created_at: Date;
  updated_at: Date;
}

describe('Seed Database', () => {
  let runner: SeedRunner;
  let client: Client;
  let databaseUrl: string;

  beforeAll(async () => {
    // Initialize client once for the entire test suite
    client = new Client(dbConfig);
    await client.connect();
    
    // Construct database URL for SeedRunner
    databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    // Create test fixtures directory
    const fixturesPath = path.join(__dirname, 'fixtures');
    try {
      await fs.mkdir(fixturesPath, { recursive: true });
    } catch {
      console.log("Directory already exists.");
    }

    runner = new SeedRunner(databaseUrl, fixturesPath);
    await runner.connect();

    // Clean up geography_levels table before each test and handle deadlocks gracefully
    const cleanupWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await client.query('TRUNCATE TABLE geography_levels RESTART IDENTITY CASCADE');
          return; // Success
        } catch (error: unknown) {
          if (error.code === '40P01' && attempt < maxRetries) { // Deadlock detected
            console.log(`Deadlock detected on attempt ${attempt}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 100)); // Exponential backoff
          } else {
            throw error; // Re-throw if not a deadlock or max retries exceeded
          }
        }
      }
    };

    await cleanupWithRetry();
  });

  afterEach(async () => {
    await runner.disconnect();
  });

  describe('geography_levels seed', () => {
    it('should seed geography levels with parent relationships', async () => {
      // Create test geography levels data
      const testGeographyData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          },
          {
            name: "State",
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state",
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "010"
          },
          {
            name: "County",
            description: "Counties and county equivalents",
            get_variable: "COUNTY",
            query_name: "county",
            on_spine: true,
            summary_level: "050",
            parent_summary_level: "040"
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels.json');
      await fs.writeFile(filePath, JSON.stringify(testGeographyData));

      // Run the seed with the simplified configuration
      const seedConfig = {
        file: 'geography_levels.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        beforeSeed: async (client: Client) => {
          // Create indexes
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_geography_levels_summary_level 
            ON geography_levels(summary_level);
          `);
          
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_geography_levels_parent_summary_level 
            ON geography_levels(parent_summary_level);
          `);
        },
        afterSeed: async (client: Client) => {
          // Update parent relationships
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      await runner.seed(seedConfig);

      // Verify data was inserted
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels ORDER BY summary_level');
      expect(result.rows).toHaveLength(3);
      
      // Verify specific records
      const nation = result.rows.find(row => row.summary_level === '010');
      const state = result.rows.find(row => row.summary_level === '040');
      const county = result.rows.find(row => row.summary_level === '050');
      
      expect(nation?.name).toBe('Nation');
      expect(nation?.parent_geography_level_id).toBeNull();
      
      expect(state?.name).toBe('State');
      expect(state?.parent_geography_level_id).toBe(nation?.id);
      
      expect(county?.name).toBe('County');
      expect(county?.parent_geography_level_id).toBe(state?.id);
    });

    it('should handle idempotent seeding (skip existing records)', async () => {
      // Create test data
      const testGeographyData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          },
          {
            name: "State",
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state", 
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "010"
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_idempotent.json');
      await fs.writeFile(filePath, JSON.stringify(testGeographyData));

      const seedConfig = {
        file: 'geography_levels_idempotent.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        afterSeed: async (client: Client) => {
          // Update parent relationships
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      // Run seed twice
      await runner.seed(seedConfig);
      await runner.seed(seedConfig);

      // Should still have only 2 records (not duplicated)
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels ORDER BY summary_level');
      expect(result.rows).toHaveLength(2);
      
      // Verify the records are correct
      const nation = result.rows.find(row => row.summary_level === '010');
      const state = result.rows.find(row => row.summary_level === '040');
      
      expect(nation?.name).toBe('Nation');
      expect(state?.name).toBe('State');
      expect(state?.parent_geography_level_id).toBe(nation?.id);
    });

    it('should handle partial updates (new records only)', async () => {
      // First, seed with initial data
      const initialData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          }
        ]
      };

      const filePath1 = path.join(__dirname, 'fixtures', 'geography_levels_initial.json');
      await fs.writeFile(filePath1, JSON.stringify(initialData));

      const seedConfig1 = {
        file: 'geography_levels_initial.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels'
      };

      await runner.seed(seedConfig1);

      // Then, seed with additional data (including existing record)
      const additionalData = {
        geography_levels: [
          {
            name: "Nation", // Existing - should be skipped
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          },
          {
            name: "State", // New - should be inserted
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state",
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "010"
          }
        ]
      };

      const filePath2 = path.join(__dirname, 'fixtures', 'geography_levels_additional.json');
      await fs.writeFile(filePath2, JSON.stringify(additionalData));

      const seedConfig2 = {
        file: 'geography_levels_additional.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        afterSeed: async (client: Client) => {
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      await runner.seed(seedConfig2);

      // Should have 2 records total
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels ORDER BY summary_level');
      expect(result.rows).toHaveLength(2);
      
      const nation = result.rows.find(row => row.summary_level === '010');
      const state = result.rows.find(row => row.summary_level === '040');
      
      expect(nation?.name).toBe('Nation');
      expect(state?.name).toBe('State');
      expect(state?.parent_geography_level_id).toBe(nation?.id);
    });

    it('should handle complex parent-child relationships', async () => {
      // Create a more complex hierarchy
      const testData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          },
          {
            name: "Region",
            description: "Census Regions",
            get_variable: "REGION",
            query_name: "region",
            on_spine: true,
            summary_level: "020",
            parent_summary_level: "010"
          },
          {
            name: "Division",
            description: "Census Divisions",
            get_variable: "DIVISION",
            query_name: "division",
            on_spine: true,
            summary_level: "030",
            parent_summary_level: "020"
          },
          {
            name: "State",
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state",
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "030"
          },
          {
            name: "County",
            description: "Counties and county equivalents",
            get_variable: "COUNTY",
            query_name: "county",
            on_spine: true,
            summary_level: "050",
            parent_summary_level: "040"
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_complex.json');
      await fs.writeFile(filePath, JSON.stringify(testData, null, 2));

      const seedConfig = {
        file: 'geography_levels_complex.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        beforeSeed: async (client: Client) => {
          console.log('Before seed - complex relationships test');
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_geography_levels_summary_level 
            ON geography_levels(summary_level);
          `);
        },
        afterSeed: async (client: Client) => {
          console.log('After seed - complex relationships test');
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      await runner.seed(seedConfig);

      // Verify the hierarchy was established correctly
      const result = await client.query<{
        name: string;
        summary_level: string;
        parent_name: string | null;
        parent_summary_level: string | null;
      }>(`
        SELECT 
          g.name,
          g.summary_level,
          p.name as parent_name,
          p.summary_level as parent_summary_level
        FROM geography_levels g
        LEFT JOIN geography_levels p ON g.parent_geography_level_id = p.id
        ORDER BY g.summary_level
      `);

      expect(result.rows).toHaveLength(5);

      // Verify specific parent-child relationships
      const nation = result.rows.find(row => row.summary_level === '010');
      const region = result.rows.find(row => row.summary_level === '020');
      const division = result.rows.find(row => row.summary_level === '030');
      const state = result.rows.find(row => row.summary_level === '040');
      const county = result.rows.find(row => row.summary_level === '050');

      expect(nation?.parent_name).toBeNull();
      expect(region?.parent_name).toBe('Nation');
      expect(division?.parent_name).toBe('Region');
      expect(state?.parent_name).toBe('Division');
      expect(county?.parent_name).toBe('State');
    });

    it('should handle missing parent references gracefully', async () => {
      // Create data with a missing parent reference
      const testData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          },
          {
            name: "State",
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state",
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "999" // Non-existent parent
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_missing_parent.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'geography_levels_missing_parent.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        beforeSeed: async (client: Client) => {
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_geography_levels_summary_level 
            ON geography_levels(summary_level);
          `);
        },
        afterSeed: async (client: Client) => {
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      // Should not throw an error
      await runner.seed(seedConfig);

      // Verify data was inserted but parent relationship is null
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels ORDER BY summary_level');
      expect(result.rows).toHaveLength(2);
      
      const nation = result.rows.find(row => row.summary_level === '010');
      const state = result.rows.find(row => row.summary_level === '040');
      
      expect(nation?.parent_geography_level_id).toBeNull();
      expect(state?.parent_geography_level_id).toBeNull(); // Should be null due to missing parent
    });

    it('should validate that geography levels are properly structured', async () => {
      // Test with properly structured data
      const testData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_validation.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'geography_levels_validation.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels'
      };

      // Should complete successfully
      await expect(runner.seed(seedConfig)).resolves.not.toThrow();

      // Verify data structure
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Nation');
      expect(result.rows[0].summary_level).toBe('010');
      expect(result.rows[0].on_spine).toBe(true);
    });

    it('should throw error when conflictColumn is missing', async () => {
      const testData = {
        geography_levels: [
          {
            name: "Nation",
            description: "United States total",
            get_variable: "NATION",
            query_name: "us",
            on_spine: true,
            summary_level: "010",
            parent_summary_level: null
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_no_conflict.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'geography_levels_no_conflict.json',
        table: 'geography_levels',
        dataPath: 'geography_levels'
        // Missing conflictColumn
      };

      await expect(runner.seed(seedConfig))
        .rejects.toThrow('conflictColumn is required for table geography_levels');
    });

    it('should preserve existing data when new records are added', async () => {
      // Insert some initial data directly
      await client.query(`
        INSERT INTO geography_levels (name, description, get_variable, query_name, on_spine, summary_level, parent_summary_level)
        VALUES ('Nation', 'United States total', 'NATION', 'us', true, '010', null)
      `);

      // Now try to seed with data that includes the existing record plus new ones
      const testData = {
        geography_levels: [
          {
            name: "Nation Updated", // Different name - should be skipped (existing summary_level)
            description: "United States total - updated",
            get_variable: "NATION_NEW",
            query_name: "us_new", 
            on_spine: false,
            summary_level: "010", // Same summary_level - should conflict
            parent_summary_level: null
          },
          {
            name: "State", // New record - should be inserted
            description: "States and State equivalents",
            get_variable: "STATE",
            query_name: "state",
            on_spine: true,
            summary_level: "040",
            parent_summary_level: "010"
          }
        ]
      };

      const filePath = path.join(__dirname, 'fixtures', 'geography_levels_preserve.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'geography_levels_preserve.json',
        table: 'geography_levels',
        conflictColumn: 'summary_level',
        dataPath: 'geography_levels',
        afterSeed: async (client: Client) => {
          await client.query(`
            UPDATE geography_levels 
            SET parent_geography_level_id = (
              SELECT id 
              FROM geography_levels parent 
              WHERE parent.summary_level = geography_levels.parent_summary_level
            )
            WHERE parent_summary_level IS NOT NULL;
          `);
        }
      };

      await runner.seed(seedConfig);

      // Should have 2 records total
      const result = await client.query<GeographyLevelRow>('SELECT * FROM geography_levels ORDER BY summary_level');
      expect(result.rows).toHaveLength(2);

      // Verify the original record was NOT updated
      const nation = result.rows.find(row => row.summary_level === '010');
      const state = result.rows.find(row => row.summary_level === '040');

      expect(nation?.name).toBe('Nation'); // Original name preserved
      expect(nation?.get_variable).toBe('NATION'); // Original value preserved
      expect(nation?.on_spine).toBe(true); // Original value preserved

      expect(state?.name).toBe('State'); // New record was inserted
      expect(state?.parent_geography_level_id).toBe(nation?.id); // Relationship established
    });
  });
});