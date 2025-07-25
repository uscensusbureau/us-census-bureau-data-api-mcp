import { promises as fs } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { fileURLToPath } from 'url';
import { z } from 'zod';

import { SeedConfig, SeedConfigSchema } from '../../schema/seed-config.schema.js';

// Fix for ES modules - create __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SeedRunner {
  private client: Client;
  private dataPath: string;

  constructor(dbUrl: string, dataPath?: string) {
    this.client = new Client({ connectionString: dbUrl });
    // Only use __dirname as fallback if no dataPath provided
    const defaultPath = path.join(__dirname, '../../../data');
    this.dataPath = dataPath || defaultPath;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async fetchFromApi(url: string, queryParams?: Record<string, string>): Promise<any> {
    const urlObj = new URL(url);
    
    // Add query parameters
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        urlObj.searchParams.append(key, value);
      }
    }
    
    const response = await fetch(urlObj.toString());

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Load JSON file and extract data
  async loadData(
    source: string, 
    extractPath?: string, 
    isUrl: boolean = false, 
    queryParams?: Record<string, string | number | boolean>
  ): Promise<any[]> {
    let data: unknown;

    if (isUrl) {
      let stringParams: Record<string, string> | undefined;

      if (queryParams) {
        stringParams = {};
        for (const [key, value] of Object.entries(queryParams)) {
          stringParams[key] = String(value);
        }
      }

      // Fetch Data from the API
      data = await this.fetchFromApi(source, stringParams);
    } else {
      // Use the filepath
      const filePath = path.join(this.dataPath, source);
      const content = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(content);
    }

    // Extract nested data if needed
    if (extractPath) {
      const keys = extractPath.split('.');
      data = keys.reduce((currentData, key) => {
        if (currentData && typeof currentData === 'object' && key in currentData) {
          return (currentData as Record<string, unknown>)[key];
        }
        throw new Error(`Key "${key}" not found in data from ${source}`);
      }, data);
    }

    if (!Array.isArray(data)) {
      throw new Error(`Expected array data from ${source}, got ${typeof data}`);
    }

    return data;
  }

  // Insert with skip-on-conflict behavior
  async insertOrSkip(tableName: string, data: Record<string, any>[], conflictColumn: string): Promise<void> {
    if (!data.length) return;
    
    const columns = Object.keys(data[0]);
    
    // Validate that conflict column exists in data
    if (!columns.includes(conflictColumn)) {
      throw new Error(`Conflict column '${conflictColumn}' not found in data. Available columns: ${columns.join(', ')}`);
    }
    
    const values = data.map(record => columns.map(col => record[col]));
    
    // Build parameterized query
    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES ${placeholders}
      ON CONFLICT (${conflictColumn}) 
      DO NOTHING
    `;
    
    console.log(`Executing insert-or-skip query with conflict on: ${conflictColumn}`);
    console.log('Existing records will be skipped, only new records will be inserted');
    
    await this.client.query(query, values.flat());
    console.log(`Processed ${data.length} records for ${tableName} (inserted new, skipped existing)`);
  }

  // Run a seed with optional setup/cleanup hooks
  async seed(config: unknown): Promise<void> {
    // Validate Seed Config
    const validConfig = this.validateSeedConfig(config);
    
    const { 
      file, url, table, conflictColumn, dataPath,
      beforeSeed, afterSeed, queryParams 
    } = validConfig;
    
    const source = file || url!;
    const isUrl = !!url;
  
    console.log(`Seeding table ${table} from ${source}.`)
    
    try {
      await this.client.query('BEGIN');
      
      // Load raw data
      const rawData = await this.loadData(source, dataPath, isUrl, queryParams);
      
      if (beforeSeed) {
        // Run beforeSeed logic
        await beforeSeed(this.client, rawData);
      }
      
      await this.insertOrSkip(table, rawData, conflictColumn);
      
      if (afterSeed) {
        // Run afterSeed logic
        await afterSeed(this.client);
      }
      
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      console.error(`Seeding failed for ${table}: `, (error as Error).message);
      throw error;
    }
  }

  private validateSeedConfig(config: unknown): SeedConfig {
    try {
      return SeedConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue, i) => {
          const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
          console.error(`${i + 1}. ${path}: ${issue.message}`);
          
          if (issue.code === 'custom' && 'params' in issue) {
            console.error(`Details: ${JSON.stringify(issue.params)}`);
          }
        });
      }
      throw new Error(`SeedConfig validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default SeedRunner;