interface GeographyLevelMetadata {
  querySyntax: string;
  code: string;
  queryExample: string;
  requiresFIPS: boolean;
  onSpine: level.boolean;
}

export interface GeographyLevelRow {
  id: number;
  name: string;
  description: string | null;
  get_variable: string;
  query_name: string;
  on_spine: boolean;
  summary_level: string;
  parent_summary_level: string | null;
  parent_geography_level_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface GeographyMetadata {
  [levelName: string]: GeographyLevelMetadata;
}

export interface ParsedGeographyEntry {
  vintage: string;
  displayName: string;
  querySyntax: string;
  code: string;
  name: string;
  hierarchy: string[];
  fullName: string;
  description?: string;
  requiresFIPS: boolean;
  onSpine: boolean;
  queryExample: string;
  requires?: string[];
  allowsWildcard: boolean;
  wildcardFor?: string[];
}