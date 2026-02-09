import { MigrationBuilder } from 'node-pg-migrate'
import {
  searchGeographiesBySummaryLevelSql,
  searchGeographiesBySummaryLevelReturnSql,
} from './1756926825327_add-geographies-search-functions.js'

export const updatedSearchGeographiesBySummaryLevelSql = `
	SELECT 
	  g.id,
	  g.name,
	  sl.name as summary_level_name,
	  g.latitude,
	  g.longitude,
	  g.for_param,
	  g.in_param,
	  SIMILARITY(g.name, $1) as similarity
	FROM geographies g
	LEFT JOIN summary_levels sl ON g.summary_level_code = sl.code
	WHERE 
	  g.summary_level_code = $2
	  AND (
	    g.name % $1
	    OR g.name ILIKE '%' || $1 || '%'
	  )
	ORDER BY 
	  SIMILARITY(g.name, $1) DESC,
	  LENGTH(g.name) ASC,
	  g.name ASC
	LIMIT $3;
`

export const updatedSearchGeographiesBySummaryLevelReturnSql = `
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

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropFunction('search_geographies_by_summary_level', [
    'TEXT',
    'TEXT',
    'INTEGER',
  ])

  // Recreate with fixed SQL
  pgm.createFunction(
    'search_geographies_by_summary_level',
    [
      { name: 'search_term', type: 'TEXT' },
      { name: 'summary_level_code', type: 'TEXT' },
      { name: 'result_limit', type: 'INTEGER', default: 10 },
    ],
    {
      returns: updatedSearchGeographiesBySummaryLevelReturnSql,
      language: 'sql',
    },
    updatedSearchGeographiesBySummaryLevelSql,
  )
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropFunction('search_geographies_by_summary_level', [
    'TEXT',
    'TEXT',
    'INTEGER',
  ])

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
    },
    searchGeographiesBySummaryLevelSql,
  )
}
