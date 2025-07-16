import { Client } from 'pg';

export interface SeedConfig {
  file: string;
  table: string;
  conflictColumn: string;
  dataPath?: string;
  beforeSeed?: (client: Client) => Promise<void>;
  afterSeed?: (client: Client) => Promise<void>;
}