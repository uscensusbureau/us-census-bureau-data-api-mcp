export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
}

export interface IndexInfo {
  indexname: string;
  indexdef: string;
}

export interface MigrationInfo {
  name: string;
  run_on: Date;
}