import { MigrationBuilder } from 'node-pg-migrate'

export const summaryLevelsNameIdxSql = `
	CREATE INDEX IF NOT EXISTS idx_summary_levels_name_gin 
	ON summary_levels 
	USING gin (name gin_trgm_ops);
`

export const summaryLevelsCodeIdxSql = `
	CREATE INDEX IF NOT EXISTS idx_summary_levels_code 
	ON summary_levels (code);
`

export const dropFunctionSql = `
	DROP FUNCTION IF EXISTS search_places(text, character, text[], integer);
  DROP FUNCTION IF EXISTS fuzzy_search_places CASCADE;
  DROP FUNCTION IF EXISTS resolve_geography_by_coordinates CASCADE;
`

export const hierarchySql = `
  UPDATE summary_levels SET hierarchy_level = 
    CASE code
      WHEN '010' THEN 1   -- Nation
      WHEN '040' THEN 2   -- State
      WHEN '160' THEN 3   -- Place (Incorporated Place)
      WHEN '050' THEN 4   -- County
      WHEN '060' THEN 5   -- County Subdivision
      WHEN '020' THEN 6   -- Region (lower priority than counties)
      WHEN '030' THEN 7   -- Division (lower priority than counties)
      WHEN '140' THEN 8   -- Census Tract
      WHEN '150' THEN 9   -- Block Group
      WHEN '860' THEN 10  -- ZIP Code Tabulation Area
      ELSE 99             -- All others get lowest priority
    END;
`

export const searchGeographiesSql = `
  SELECT 
    g.id,
    g.name,
    sl.name as summary_level_name,
    g.latitude,
    g.longitude,
    g.for_param,
    g.in_param,
    -- Weighted score: similarity + hierarchy boost
    (SIMILARITY(g.name, search_term) + (1.0 - (sl.hierarchy_level::real / 100.0))) as weighted_score
  FROM geographies g
  LEFT JOIN summary_levels sl ON g.summary_level_code = sl.code
  WHERE 
    g.name % search_term  -- Uses trigram similarity operator
    OR g.name ILIKE '%' || search_term || '%'  -- Fallback for partial matches
  ORDER BY 
    weighted_score DESC,  -- Combined similarity + hierarchy score
    LENGTH(g.name) ASC,   -- Prefer shorter names when scores are equal
    g.name ASC
  LIMIT result_limit;
`

export const searchGeographiesBySummaryLevelSql = `
	SELECT 
	  g.id,
	  g.name,
	  sl.name as summary_level_name,
	  g.latitude,
	  g.longitude,
	  g.for_param,
	  g.in_param,
	  SIMILARITY(g.name, search_term) as similarity
	FROM geographies g
	LEFT JOIN summary_levels sl ON g.summary_level_code = sl.code
	WHERE 
	  g.summary_level_code = summary_level_code
	  AND (
	    g.name % search_term  -- Uses trigram similarity operator
	    OR g.name ILIKE '%' || search_term || '%'  -- Fallback for partial matches
	  )
	ORDER BY 
	  SIMILARITY(g.name, search_term) DESC,
	  LENGTH(g.name) ASC,   -- Prefer shorter names when similarity is equal
	  g.name ASC
	LIMIT result_limit;
`

export const searchGeographiesReturnSql = `
	TABLE(
		id INTEGER, 
		name TEXT, 
		summary_level_name TEXT, 
		latitude NUMERIC, 
		longitude NUMERIC, 
		for_param TEXT, 
		in_param TEXT, 
		weighted_score REAL
	)
`

export const searchGeographiesBySummaryLevelReturnSql = `
	TABLE(
		id INTEGER, 
		name TEXT, 
		summary_level_name TEXT, 
		latitude NUMERIC, 
		longitude NUMERIC, 
		for_param TEXT, 
		in_param TEXT, 
		similarity REAL
	)
`

export const searchSummaryLevelsSql = `
  SELECT 
    sl.code as code,
    sl.name as name
  FROM summary_levels sl
  WHERE 
    sl.code = LPAD($1, 3, '0')  -- exact code match
    OR LOWER(sl.name) = LOWER(TRIM($1))  -- exact name match
    OR SIMILARITY(LOWER(sl.name), LOWER(TRIM($1))) > 0.3  -- fuzzy name match
  ORDER BY 
    CASE 
      WHEN sl.code = LPAD($1, 3, '0') THEN 1.00
      WHEN LOWER(sl.name) = LOWER(TRIM($1)) THEN 1.00
      ELSE SIMILARITY(LOWER(sl.name), LOWER(TRIM($1)))
    END DESC,
    CASE 
      WHEN sl.code = LPAD($1, 3, '0') THEN 1
      WHEN LOWER(sl.name) = LOWER(TRIM($1)) THEN 2
      ELSE 3
    END
  LIMIT COALESCE($2, 5)
`

export const searchSummaryLevelsReturnSql = `
  TABLE (
    code TEXT,
    name TEXT
  )
`

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop search functions referencing older tables
  pgm.sql(dropFunctionSql)

  pgm.addColumns('summary_levels', {
    hierarchy_level: { type: 'integer', default: 99 },
  })

  // Update hierarchy levels in summary_levels based on summary level popularity
  pgm.sql(hierarchySql)

  // Create the search function with weighted summary level priority
  pgm.createFunction(
    'search_geographies',
    [
      { name: 'search_term', type: 'TEXT' },
      { name: 'result_limit', type: 'INTEGER', default: 10 },
    ],
    {
      returns: searchGeographiesReturnSql,
      language: 'sql',
      stable: true,
    },
    searchGeographiesSql,
  )

  // Create a filtered search function by summary level
  pgm.createFunction(
    'search_geographies_by_summary_level',
    [
      { name: 'search_term', type: 'TEXT' },
      { name: 'summary_level_code', type: 'TEXT' },
      { name: 'result_limit', type: 'INTEGER', default: 10 },
    ],
    {
      returns: searchGeographiesBySummaryLevelReturnSql,
      language: 'sql',
      stable: true,
    },
    searchGeographiesBySummaryLevelSql,
  )

  pgm.createFunction(
    'search_summary_levels',
    [
      { name: 'search_term', type: 'TEXT' },
      { name: 'result_limit', type: 'INTEGER', default: 1 },
    ],
    {
      returns: searchSummaryLevelsReturnSql,
      language: 'sql',
      stable: true,
    },
    searchSummaryLevelsSql,
  )

  pgm.sql(summaryLevelsNameIdxSql)
  pgm.sql(summaryLevelsCodeIdxSql)
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropFunction('search_geographies_by_summary_level', [
    'TEXT',
    'TEXT',
    'INTEGER',
  ])
  pgm.dropFunction('search_geographies', ['TEXT', 'INTEGER'])
  pgm.dropFunction('search_summary_levels', ['TEXT', 'INTEGER'])

  pgm.dropColumns('summary_levels', ['hierarchy_level'])

  pgm.sql('DROP INDEX IF EXISTS idx_summary_levels_name_gin;')
  pgm.sql('DROP INDEX IF EXISTS idx_summary_levels_code;')
}
