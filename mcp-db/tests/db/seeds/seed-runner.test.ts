import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
 
import { dbConfig } from '../../helpers/database-config';
import { SeedRunner } from '../../../src/seeds/scripts/seed-runner';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testTableName = 'geography_levels_seed_runner_test';
 
describe('SeedRunner', () => {
  let client: Client;
  let runner: SeedRunner;
 
  beforeAll(async () => {
    // Initialize client once for the entire test suite
    client = new Client(dbConfig);
    await client.connect();
    
    // Create test table for geography levels tests
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${testTableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        get_variable VARCHAR(50),
        query_name VARCHAR(255),
        on_spine BOOLEAN DEFAULT false,
        summary_level VARCHAR(10) UNIQUE NOT NULL,
        parent_summary_level VARCHAR(10),
        parent_geography_level_id INTEGER REFERENCES ${testTableName}(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`Created test table: ${testTableName}`);
  });
 
  afterAll(async () => {
    // Clean up test table
    await client.query(`DROP TABLE IF EXISTS ${testTableName} CASCADE`);
    await client.end();
    console.log(`Dropped test table: ${testTableName}`);
  });
 
  beforeEach(async () => {
    // Create test fixtures directory if it doesn't exist
    const fixturesPath = path.join(__dirname, 'fixtures');
    console.log(`Test fixtures path: ${fixturesPath}`); // Debug log
    console.log(`__dirname in test: ${__dirname}`); // Debug log
    try {
      await fs.mkdir(fixturesPath, { recursive: true });
      console.log(`Successfully created/verified fixtures directory`);
    } catch (error) {
      console.log("Directory creation failed:", error);
    }
 
    // Set up test database connection using the simplified constructor with fixtures path
    const databaseUrl = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
    console.log(`About to create SeedRunner with dataPath: ${fixturesPath}`);
    runner = new SeedRunner(databaseUrl, fixturesPath);
    await runner.connect();
 
    // Clean test table before each test
    await client.query(`DELETE FROM ${testTableName}`);
  });
 
  afterEach(async () => {
    await runner.disconnect();
  });
 
  describe('loadData', () => {
    it('should load a simple JSON file', async () => {
      const testData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];
      const filePath = path.join(__dirname, 'fixtures', 'simple.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      const result = await runner.loadData('simple.json');
      expect(result).toEqual(testData);
    });
 
    it('should handle nested JSON with dataPath', async () => {
      const testData = {
        items: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' }
        ]
      };
      const filePath = path.join(__dirname, 'fixtures', 'nested.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      const result = await runner.loadData('nested.json', 'items');
      expect(result).toEqual(testData.items);
    });
 
    it('should handle deeply nested JSON', async () => {
      const testData = {
        config: {
          seeds: {
            geography_levels: [
              { id: 1, name: 'Nation', summary_level: '010' }
            ]
          }
        }
      };
      const filePath = path.join(__dirname, 'fixtures', 'deep.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      const result = await runner.loadData('deep.json', 'config.seeds.geography_levels');
      expect(result).toEqual(testData.config.seeds.geography_levels);
    });
 
    it('should throw error for non-array data', async () => {
      const testData = { message: 'not an array' };
      const filePath = path.join(__dirname, 'fixtures', 'invalid.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      await expect(runner.loadData('invalid.json')).rejects.toThrow('Expected array data from invalid.json, got object');
    });
  });

  describe('insertOrSkip', () => {
    beforeEach(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_items (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        )
      `);
    });

    afterEach(async () => {
      await client.query('DROP TABLE IF EXISTS test_items');
    });

    it('should insert new records', async () => {
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      await runner.insertOrSkip('test_items', testData, 'id');

      const result = await client.query('SELECT * FROM test_items ORDER BY id');
      expect(result.rows).toEqual(testData);
    });

    it('should skip existing records on conflict', async () => {
      // Insert initial data
      const initialData = [
        { id: 1, name: 'Original Item 1' }
      ];
      await runner.insertOrSkip('test_items', initialData, 'id');

      // Try to insert conflicting data
      const newData = [
        { id: 1, name: 'Updated Item 1' }, // Should be skipped
        { id: 2, name: 'Item 2' }          // Should be inserted
      ];
      await runner.insertOrSkip('test_items', newData, 'id');

      const result = await client.query('SELECT * FROM test_items ORDER BY id');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Original Item 1'); // Not updated
      expect(result.rows[1].name).toBe('Item 2');           // New record
    });

    it('should throw error for missing conflict column', async () => {
      const testData = [
        { id: 1, name: 'Item 1' }
      ];

      await expect(runner.insertOrSkip('test_items', testData, 'nonexistent_column'))
        .rejects.toThrow("Conflict column 'nonexistent_column' not found in data");
    });

    it('should handle empty data gracefully', async () => {
      await runner.insertOrSkip('test_items', [], 'id');
      
      const result = await client.query('SELECT COUNT(*) as count FROM test_items');
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });
 
  describe('seed', () => {
    beforeEach(async () => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_items (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        )
      `);
    });
 
    afterEach(async () => {
      await client.query('DROP TABLE IF EXISTS test_items');
    });
 
    it('should run a complete seed operation', async () => {
      const testData = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      };
      const filePath = path.join(__dirname, 'fixtures', 'test_items.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      const seedConfig = {
        file: 'test_items.json',
        table: 'test_items',
        conflictColumn: 'id',
        dataPath: 'items'
      };
 
      await runner.seed(seedConfig);
 
      const result = await client.query('SELECT * FROM test_items ORDER BY id');
      expect(result.rows).toEqual(testData.items);
    });

    it('should throw error when conflictColumn is missing', async () => {
      const testData = [{ id: 1, name: 'Test 1' }];
      const filePath = path.join(__dirname, 'fixtures', 'test_no_conflict.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'test_no_conflict.json',
        table: 'test_items'
        // Missing conflictColumn
      };

      await expect(runner.seed(seedConfig)).rejects.toThrow();
    });

    it('should handle idempotent operations', async () => {
      const testData = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
      };
      const filePath = path.join(__dirname, 'fixtures', 'test_idempotent.json');
      await fs.writeFile(filePath, JSON.stringify(testData));

      const seedConfig = {
        file: 'test_idempotent.json',
        table: 'test_items',
        conflictColumn: 'id',
        dataPath: 'items'
      };

      // Run seed twice
      await runner.seed(seedConfig);
      await runner.seed(seedConfig);

      // Should still have only 2 records
      const result = await client.query('SELECT COUNT(*) as count FROM test_items');
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
 
    it('should call beforeSeed and afterSeed hooks', async () => {
      const testData = [
        { id: 1, name: 'Test 1' }
      ];
      const filePath = path.join(__dirname, 'fixtures', 'test_hooks.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      let beforeCalled = false;
      let afterCalled = false;
 
      const seedConfig = {
        file: 'test_hooks.json',
        table: 'test_items',
        conflictColumn: 'id',
        beforeSeed: async (client: Client) => {
          beforeCalled = true;
          // Verify we can use the client
          await client.query('SELECT 1');
        },
        afterSeed: async (client: Client) => {
          afterCalled = true;
          // Verify we can use the client
          await client.query('SELECT 1');
        }
      };
 
      await runner.seed(seedConfig);
 
      expect(beforeCalled).toBe(true);
      expect(afterCalled).toBe(true);
    });
 
    it('should rollback on error', async () => {
      const testData = [
        { id: 1, name: 'Test 1' }
      ];
      const filePath = path.join(__dirname, 'fixtures', 'test_error.json');
      await fs.writeFile(filePath, JSON.stringify(testData));
 
      const seedConfig = {
        file: 'test_error.json',
        table: 'test_items',
        conflictColumn: 'id',
        afterSeed: async () => {
          throw new Error('Test error');
        }
      };
 
      await expect(runner.seed(seedConfig)).rejects.toThrow('Test error');
 
      // Verify no data was inserted due to rollback
      const result = await client.query('SELECT COUNT(*) as count FROM test_items');
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });

  describe('validateSeedConfig', () => {
    it('should return the parsed config when validation passes', () => {
      const validConfig = {
        file: 'test.json',
        table: 'test_table',
        conflictColumn: 'id'
      };

      const result = (runner).validateSeedConfig(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should throw when validation fails', () => {
      const invalidConfig = {
        file: 'test.json',
        table: 'test_table'
        // conflictColumn is missing
      };

      expect(() => {
        (runner).validateSeedConfig(invalidConfig);
      }).toThrow('SeedConfig validation failed');

    });

    it('should handle non-Zod errors and still throw', () => {
      const invalidConfig = null;

      expect(() => {
        (runner).validateSeedConfig(invalidConfig);
      }).toThrow('SeedConfig validation failed');
    });
  });
});