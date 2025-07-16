import { Client } from 'pg';
import 'dotenv/config';
import { z } from 'zod';

import { GeographyLevelSchema } from '../../schema/geography-level.schema.js';
import { SeedConfig } from '../../schema/seed-config.schema.js';
import { SeedRunner } from './seed-runner.js';

const GeographyLevelsArraySchema = z.array(GeographyLevelSchema);

type GeographyLevel = z.infer<typeof GeographyLevelSchema>;

// Get database URL from ENV
const DATABASE_URL: string = process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db';

// Seed configurations
const seeds: SeedConfig[] = [
  {
    file: 'geography_levels.json',
    table: 'geography_levels',
    dataPath: 'geography_levels',
    conflictColumn: 'summary_level',
    beforeSeed: async (client: Client): Promise<void> => {
      console.log('Validating geography levels data...');
      
      const runner = new SeedRunner(DATABASE_URL);
      const rawData = await runner.loadData('geography_levels.json', 'geography_levels');
      
      try {
        // Validate entire array with Zod
        const validatedData = GeographyLevelsArraySchema.parse(rawData);
        console.log(`Validation passed for ${validatedData.length} records`);
        
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Validation failed:');
          error.issues.forEach((issue: z.ZodIssue, i) => {
            console.error(`${i + 1}. Path: ${issue.path.join('.')} - ${issue.message}`);
            console.error(`Code: ${issue.code}`);
            console.error(`Details: ${JSON.stringify(issue, null, 2)}`);
          });
        }
        throw new Error(`Geography levels data validation failed: ${error}`);
      }
    },
    afterSeed: async (client: Client): Promise<void> => {
      // Set up parent relationships. geography_levels table created via migrations
      await client.query(`
        UPDATE geography_levels 
        SET parent_geography_level_id = (
          SELECT id FROM geography_levels parent 
          WHERE parent.summary_level = geography_levels.parent_summary_level
        )
        WHERE parent_summary_level IS NOT NULL;
      `);
      
      // Verify relationships
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(parent_geography_level_id) as with_parent,
          COUNT(CASE WHEN parent_summary_level IS NOT NULL THEN 1 END) as should_have_parent
        FROM geography_levels;
      `);
      
      const { total, with_parent, should_have_parent } = result.rows[0];
      console.log(`Geography levels: ${total} total, ${with_parent}/${should_have_parent} with parents`);
      
      if (with_parent !== should_have_parent) {
        const orphans = await client.query(`
          SELECT name, summary_level, parent_summary_level 
          FROM geography_levels 
          WHERE parent_summary_level IS NOT NULL AND parent_geography_level_id IS NULL
        `);
        console.warn('Orphaned records:', orphans.rows);
      }
    }
  }
];

async function main(): Promise<void> {
  console.log('Starting database seeding...');
  
  const runner = new SeedRunner(DATABASE_URL);
  
  try {
    await runner.connect();
    console.log('Connected to database');
    
    // Run specific seed or all seeds
    const seedName: string | undefined = process.argv[2];
    const seedsToRun: SeedConfig[] = seedName ? seeds.filter(s => s.file === seedName) : seeds;
    
    if (seedsToRun.length === 0) {
      console.error(`Seed file "${seedName}" not found`);
      process.exit(1);
    }
    
    // Process seeds sequentially without await in loop - using reduce instead of for loop
    await seedsToRun.reduce(async (previousSeed, seedConfig) => {
      await previousSeed; // Wait for previous seed to complete
      return runner.seed(seedConfig);
    }, Promise.resolve());
    
    console.log('Seeding completed successfully!');
    
  } catch (error) {
    console.error('Seeding failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// ES module equivalent of "if (require.main === module)"
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}