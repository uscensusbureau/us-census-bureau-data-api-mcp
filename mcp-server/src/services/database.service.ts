import 'dotenv/config';
import { Client, Pool, PoolClient } from 'pg';

type QueryParam = string | number | boolean | null | Date | Buffer;

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool;
  private client: Client | null = null;

  private constructor() {
    const DATABASE_URL: string = process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db';

    console.log('DatabaseService initializing with URL:', DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
    
    // Use connection pooling for better performance
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
    });
  }

  // Get singleton instance
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Get a client from the pool for a single query
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  // Execute a single query using a pooled connection
  public async query<T = unknown>(text: string, params?: QueryParam[]): Promise<{ rows: T[] }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release(); // Return client to pool
    }
  }

  // Get a persistent client connection. Call releaseClient() when done
  public async getPersistentClient(): Promise<Client> {
    if (!this.client) {
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_pass@localhost:5432/mcp_db';
      this.client = new Client({ connectionString: databaseUrl });
      await this.client.connect();
    }
    return this.client;
  }

  // Release the persistent client connection
  public async releasePersistentClient(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  // Execute multiple queries in a transaction
  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Database Health
  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  // Close Connections
  public async cleanup(): Promise<void> {
    await this.releasePersistentClient();
    await this.pool.end();
  }
}