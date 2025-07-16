import { promises as fs } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { fileURLToPath } from 'url';

import { SeedConfig } from '../../schema/seed-config.schema.js';

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

  // Load JSON file and extract data
  async loadData(filename: string, extractPath?: string): Promise<any[]> {
    const filePath = path.join(this.dataPath, filename);
    const content = await fs.readFile(filePath, 'utf8');
    let data: unknown = JSON.parse(content);
    
    // Handle nested JSON structures using extractPath
    if (extractPath) {
      console.log(`Extracting data from JSON path: ${extractPath}`);
      const keys = extractPath.split('.');
      
      // Process keys sequentially without await in loop - using reduce instead of for loop
      const processKey = (currentData: unknown, key: string): unknown => {
        if (currentData && typeof currentData === 'object' && currentData !== null) {
          const dataObj = currentData as Record<string, unknown>;
          if (key in dataObj) {
            console.log(`Found key "${key}", new data type: ${typeof dataObj[key]}`);
            return dataObj[key];
          } else {
            console.error(`Key "${key}" not found in data`);
            console.error(`Available keys: ${Object.keys(dataObj).join(', ')}`);
            throw new Error(`Key "${key}" not found in seed file ${filename}`);
          }
        } else {
          // Handle non-object data
          console.error(`Key "${key}" not found in data`);
          console.error(`Available keys: N/A (data is not an object)`);
          throw new Error(`Key "${key}" not found in seed file ${filename}`);
        }
      };
      
      // Use reduce to process keys sequentially without await in loop
      data = keys.reduce(processKey, data);
    }
    
    console.log(`Final data: ${Array.isArray(data) ? `Array[${data.length}]` : typeof data}`);
    
    if (!Array.isArray(data)) {
      throw new Error(`Expected array data for ${filename}, got ${typeof data}`);
    }
    
    return data;
  }

  // Simple insert with skip-on-conflict behavior
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
  async seed(config: SeedConfig): Promise<void> {
    const { file, table, conflictColumn, dataPath, beforeSeed, afterSeed } = config;
    
    if (!conflictColumn) {
      throw new Error(`conflictColumn is required for table ${table}`);
    }
    
    console.log(`Seeding ${table} from ${file}...`);
    
    try {
      await this.client.query('BEGIN');
      
      // Run setup hook
      if (beforeSeed) await beforeSeed(this.client);
      
      // Load and insert data - dataPath here is the JSON extraction path!
      const data = await this.loadData(file, dataPath);
      await this.insertOrSkip(table, data, conflictColumn);
      
      // Run cleanup hook
      if (afterSeed) await afterSeed(this.client);
      
      await this.client.query('COMMIT');
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }
}

export default SeedRunner;