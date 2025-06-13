import { z } from 'zod';
import { GeographyLevels } from '../data/geography-levels.data.js';

/**
 * Common geography codes enum for validation
 */
export const CommonGeographyCodes = z.enum([
  "010", "020", "030", "040", "050", "060", "140", "150", "155", "160", 
  "230", "250", "310", "312", "314", "330", "335", "350", "352", "355", 
  "400", "500", "610", "620", "795", "950", "960", "970"
]);

export const FetchDatasetGeographyInputSchema = z.object({
  dataset: z.string().describe("Dataset identifier (e.g., 'acs/acs1')"),
  year: z.number().describe("The year or vintage of the data, e.g. 1987").optional()
});

export const FetchDatasetGeographyArgsSchema = {
  type: "object",
  properties: {
    dataset: {
      type: "string",
      description: "The dataset identifier (e.g., 'acs/acs1')",
    },
    year: {
      type: "number",
      description: "The year of the data",
    }
  },
  required: ["dataset"]
};

/**
 * Schema for individual geography object in the fips array
 */
export const GeographyFipsEntrySchema = z.object({
  name: z.string().describe("Geography name (e.g., 'state', 'county', 'congressional district')"),
  geoLevelDisplay: z.string().describe("3-digit geography code (e.g., '040', '050', '500')"),
  referenceDate: z.string().describe("Reference date (e.g., '2022-01-01')"),
  requires: z.array(z.string()).optional().describe("Required parent geographies for this level"),
  wildcard: z.array(z.string()).optional().describe("Geographies that can use wildcards"),
  optionalWithWCFor: z.string().optional().describe("Optional wildcard geography")
});

/**
 * Schema for the actual Census geography.json API response
 * The API returns an object with a 'fips' array containing geography objects
 */
export const GeographyJsonSchema = z.object({
  fips: z.array(GeographyFipsEntrySchema).describe("Array of available geography levels")
});

/**
 * Code type system used for geographic identifiers
 * Since the geography API always returns FIPS data, we only need FIPS
 */
export const CodeTypeSchema = z.literal("FIPS");

/**
 * Parsed geography entry with structured fields
 */
export const ParsedGeographyEntrySchema = z.object({
  vintage: z.string().describe("Reference date for this geography level"),
  displayName: z.string().describe("Human-readable display name (e.g., 'State', 'Congressional District')"),
  querySyntax: z.string().describe("Exact syntax for API queries (e.g., 'state', 'congressional+district')"),
  code: z.string().describe("3-digit geography level code"),
  name: z.string().describe("Technical name from API response"),
  hierarchy: z.array(z.string()).describe("Array of hierarchy levels"),
  fullName: z.string().describe("Complete geography name"),
  description: z.string().optional().describe("Additional description if provided"),
  codeType: CodeTypeSchema.describe("Type of coding system used for this geography"),
  requiresFIPS: z.boolean().describe("Whether this geography requires FIPS codes for querying"),
  isHierarchical: z.boolean().describe("Whether this geography has hierarchical relationships"),
  queryExample: z.string().describe("Example API query syntax"),
  requires: z.array(z.string()).optional().describe("Required parent geographies"),
  allowsWildcard: z.array(z.string()).optional().describe("Geographies that support wildcards"),
  wildcardFor: z.string().optional().describe("Geography this can be wildcarded for")
});

/**
 * Parsed geography.json response with structured data
 */
export const ParsedGeographyJsonSchema = z.array(ParsedGeographyEntrySchema);

/**
 * Reverse mappings for lookups
 */
const GEOGRAPHY_CODE_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(GeographyLevels).map(([displayName, metadata]) => [metadata.code, displayName])
);

type GeoLevelType = {
  code: string;
  codeType: string;
  querySyntax: string;
  queryExample: string;
  requiresFIPS: boolean;
  isHierarchical: boolean;
}

/**
 * Get metadata for a geography by its code
 */
function getCodeMetadata(code: string) {
  const displayName = GEOGRAPHY_CODE_TO_DISPLAY[code];
  if (displayName) {
    const metadata = (GeographyLevels as Record<string, GeoLevelType>)[displayName];
    return {
      displayName,
      querySyntax: metadata.querySyntax,
      queryExample: metadata.queryExample,
      requiresFIPS: metadata.requiresFIPS,
      isHierarchical: metadata.isHierarchical,
      codeType: "FIPS" as const // Always FIPS for geography API responses
    };
  }
  
  return {
    displayName: `Geography ${code}`,
    querySyntax: `geography-${code}`,
    queryExample: `for=geography-${code}:*`,
    codeType: "FIPS" as const,
    requiresFIPS: true,
    isHierarchical: true
  };
}

/**
 * Convert API geography name to query syntax
 */
function nameToQuerySyntax(name: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    'american indian area/alaska native area/hawaiian home land': 'american+indian+area/alaska+native+area/hawaiian+home+land',
    'metropolitan statistical area/micropolitan statistical area': 'metropolitan+statistical+area/micropolitan+statistical+area',
    'principal city (or part)': 'principal+city+(or+part)',
    'combined statistical area': 'combined+statistical+area',
    'combined new england city and town area': 'combined+new+england+city+and+town+area',
    'new england city and town area': 'new+england+city+and+town+area',
    'principal city': 'principal+city',
    'necta division': 'necta+division',
    'urban area': 'urban+area',
    'congressional district': 'congressional+district',
    'public use microdata area': 'public+use+microdata+area',
    'school district (elementary)': 'school+district+(elementary)',
    'school district (secondary)': 'school+district+(secondary)',
    'school district (unified)': 'school+district+(unified)',
    'county subdivision': 'county+subdivision',
    'alaska native regional corporation': 'alaska+native+regional+corporation',
    'metropolitan division': 'metropolitan+division'
  };
  
  return specialCases[name] || name.replace(/\s+/g, '+');
}

/**
 * Generate query example based on geography requirements
 */
function generateQueryExample(name: string, code: string, requires?: string[]): string {
  const querySyntax = nameToQuerySyntax(name);
  
  if (!requires || requires.length === 0) {
    return `for=${querySyntax}:*`;
  }
  
  // Handle hierarchical geographies
  const parentSyntax = requires.map(req => nameToQuerySyntax(req)).join(':*&in=');
  return `for=${querySyntax}:*&in=${parentSyntax}:*`;
}

function getDisplayNameFromApiName(apiName: string): string {
  // Try to find matching display name by checking if the API name matches any query syntax
  const querySyntax = nameToQuerySyntax(apiName);

  for (const [displayName, metadata] of Object.entries(GeographyLevels)) {
   if (metadata.querySyntax === querySyntax) {
     return displayName;
   }
  }

  // Fallback: capitalize each word
  return apiName
   .split(/[\s]+/)
   .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
   .join(' ');
}


/**
 * Parse raw geography.json response into structured format
 */
export function parseGeographyJson(rawGeography: unknown): z.infer<typeof ParsedGeographyJsonSchema> {
  // Validate the raw response format
  const validatedRaw = GeographyJsonSchema.parse(rawGeography);
  
  // Handle case where fips array is empty
  if (validatedRaw.fips.length === 0) {
    console.log('No FIPS geography data found in response');
    return [];
  }
  
  // Transform each fips entry into our structured format
  const parsed = validatedRaw.fips.map((entry) => {
    const displayName = getDisplayNameFromApiName(entry.name);
    const querySyntax = nameToQuerySyntax(entry.name);
    const codeMetadata = getCodeMetadata(entry.geoLevelDisplay);
    const queryExample = generateQueryExample(entry.name, entry.geoLevelDisplay, entry.requires);
    
    return {
      vintage: entry.referenceDate,
      displayName: displayName,
      querySyntax: querySyntax,
      code: entry.geoLevelDisplay,
      name: entry.name,
      hierarchy: entry.requires ? [...entry.requires, entry.name] : [entry.name],
      fullName: displayName,
      description: undefined,
      codeType: codeMetadata.codeType,
      requiresFIPS: codeMetadata.requiresFIPS,
      isHierarchical: (entry.requires && entry.requires.length > 0) || false,
      queryExample: queryExample,
      requires: entry.requires,
      allowsWildcard: entry.wildcard,
      wildcardFor: entry.optionalWithWCFor
    };
  });
  
  // Validate the parsed structure
  return ParsedGeographyJsonSchema.parse(parsed);
}

/**
 * Type exports for convenience
 */
export type GeographyFipsEntry = z.infer<typeof GeographyFipsEntrySchema>;
export type GeographyJson = z.infer<typeof GeographyJsonSchema>;
export type ParsedGeographyEntry = z.infer<typeof ParsedGeographyEntrySchema>;
export type ParsedGeographyJson = z.infer<typeof ParsedGeographyJsonSchema>;
export type GeographyCode = z.infer<typeof CommonGeographyCodes>;
export type CodeType = z.infer<typeof CodeTypeSchema>;