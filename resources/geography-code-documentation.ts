import { CodeType, ParsedGeographyEntry, ParsedGeographyJson } from '../schema/geography.schema.js';

export const CODE_TYPE_DOCUMENTATION = {
  FIPS: {
    name: "Federal Information Processing Series (FIPS)",
    description: "The most commonly used geographic identifiers in Census data. FIPS codes are hierarchical and standardized across federal agencies.",
    usage: "Used for states, counties, places, metropolitan areas, and most administrative boundaries.",
    structure: "Hierarchical - smaller areas include codes for larger areas they nest within",
    examples: [
      { code: "06", description: "California (state)", level: "State" },
      { code: "06075", description: "San Francisco County, CA", level: "County" },
      { code: "0667000", description: "San Francisco city, CA", level: "Place" }
    ],
    queryTips: "Most API queries will use FIPS codes. Format queries as: for=county:075&in=state:06",
    agencies: ["Census Bureau", "Most federal agencies"],
    stability: "Very stable - rarely change"
  },

  GNIS: {
    name: "Geographic Names Information System",
    description: "Managed by USGS for geographic features like rivers, mountains, and landmarks. Non-hierarchical sequential codes.",
    usage: "Used for natural and cultural features that don't fit administrative boundaries.",
    structure: "Sequential assignment based on entry date - no hierarchical relationship",
    examples: [
      { code: "277128", description: "Mississippi River", level: "Physical Feature" },
      { code: "1779775", description: "Golden Gate Bridge", level: "Cultural Feature" },
      { code: "253573", description: "Mount Whitney", level: "Physical Feature" }
    ],
    queryTips: "Less common in Census data APIs. More relevant for geographic mapping services.",
    agencies: ["US Geological Survey", "US Board on Geographic Names"],
    stability: "Permanent once assigned"
  },

  CENSUS: {
    name: "Census Bureau Statistical Areas",
    description: "Codes created by Census Bureau for statistical geographic areas not covered by other systems.",
    usage: "Used for census-specific geographic divisions like tracts, block groups, and urban areas.",
    structure: "Varies by geography type - some hierarchical, some not",
    examples: [
      { code: "06075980100", description: "Census Tract 9801, San Francisco County", level: "Census Tract" },
      { code: "78904", description: "San Francisco--Oakland, CA Urban Area", level: "Urban Area" },
      { code: "00106", description: "Pacific Division", level: "Census Division" }
    ],
    queryTips: "Often combined with FIPS codes. Tracts require state+county: for=tract:980100&in=county:075&in=state:06",
    agencies: ["Census Bureau"],
    stability: "Can change between census cycles"
  },

  EDUCATION: {
    name: "Department of Education Local Education Agency (LEA)",
    description: "Codes assigned by the Department of Education for school districts.",
    usage: "Used exclusively for elementary, secondary, and unified school districts.",
    structure: "Hierarchical within states",
    examples: [
      { code: "0622710", description: "Los Angeles Unified School District", level: "Unified District" },
      { code: "0611460", description: "Fremont Union High School District", level: "Secondary District" },
      { code: "0639390", description: "Alvord Elementary School District", level: "Elementary District" }
    ],
    queryTips: "Query as: for=school+district+(unified):*&in=state:06",
    agencies: ["Department of Education"],
    stability: "Can change due to district consolidations/splits"
  },

  STATE: {
    name: "State-Assigned Codes",
    description: "Codes assigned by individual states for their internal administrative divisions.",
    usage: "Used for voting districts, state legislative districts, and other state-defined areas.",
    structure: "Varies by state - typically hierarchical within state",
    examples: [
      { code: "001", description: "California Assembly District 1", level: "State House District" },
      { code: "040", description: "California Senate District 40", level: "State Senate District" },
      { code: "000123", description: "Los Angeles County Voting District 123", level: "Voting District" }
    ],
    queryTips: "Always require state context: for=state+legislative+district+(upper+chamber):040&in=state:06",
    agencies: ["Individual state governments"],
    stability: "Changes with redistricting (every 10 years)"
  },

  INCITS: {
    name: "InterNational Committee for Information Technology Standards",
    description: "Modern replacement for some FIPS codes, managed by ANSI standards organization.",
    usage: "Used for metropolitan divisions and congressional districts after 2008 FIPS withdrawal.",
    structure: "Hierarchical, follows FIPS patterns but under new management",
    examples: [
      { code: "31084", description: "San Francisco-Redwood City-South San Francisco, CA Metro Division", level: "Metropolitan Division" },
      { code: "0612", description: "California 12th Congressional District", level: "Congressional District" }
    ],
    queryTips: "Similar to FIPS usage: for=congressional+district:12&in=state:06",
    agencies: ["ANSI via INCITS committee"],
    stability: "Congressional districts change every 10 years with redistricting"
  },

  HYBRID: {
    name: "Combined Code Systems (GEOIDs)",
    description: "Geographic identifiers that combine multiple coding systems into a single comprehensive ID.",
    usage: "Used for small geographic areas that nest within multiple larger areas.",
    structure: "Hierarchical combination of FIPS + Census codes",
    examples: [
      { code: "060750001001", description: "Block Group 1, Census Tract 1, San Francisco County", level: "Block Group" },
      { code: "060750001001001", description: "Census Block 1001 in above block group", level: "Census Block" }
    ],
    queryTips: "Often need to specify multiple geographic levels: for=block+group:1&in=tract:000100&in=county:075&in=state:06",
    agencies: ["Census Bureau combining multiple systems"],
    stability: "Most stable part (FIPS) rarely changes, Census parts can change"
  }
} as const;

/**
 * Helper function to get documentation for a specific code type
 */
export function getCodeTypeDocumentation(codeType: CodeType) {
  return CODE_TYPE_DOCUMENTATION[codeType];
}

/**
 * Generate human-readable explanation for geography entry
 */
export function explainGeographyEntry(entry: ParsedGeographyEntry): string {
  const doc = getCodeTypeDocumentation(entry.codeType);
  
  let explanation = `**${entry.fullName}** (Code: ${entry.code})\n\n`;
  
  explanation += `**Code Type:** ${doc.name}\n`;
  explanation += `${doc.description}\n\n`;
  
  explanation += `**Usage:** ${doc.usage}\n\n`;
  
  if (entry.requiresFIPS) {
    explanation += `**⚠️  Requires FIPS codes** for API queries\n`;
  } else {
    explanation += `**✅ No FIPS codes required** for basic queries\n`;
  }
  
  if (entry.isHierarchical) {
    explanation += `**🏗️ Hierarchical** - nests within: ${entry.hierarchy.slice(0, -1).join(' → ')}\n`;
  } else {
    explanation += `**🎯 Non-hierarchical** - standalone geographic level\n`;
  }
  
  explanation += `\n**Query Tips:** ${doc.queryTips}\n`;
  
  return explanation;
}

/**
 * Generate summary of all code types available in a geography response
 */
export function summarizeAvailableCodeTypes(geography: ParsedGeographyJson): string {
  const codeTypeCounts = geography.reduce((acc, entry) => {
    acc[entry.codeType] = (acc[entry.codeType] || 0) + 1;
    return acc;
  }, {} as Record<CodeType, number>);
  
  let summary = "## Available Geographic Code Types\n\n";
  
  Object.entries(codeTypeCounts).forEach(([codeType, count]) => {
    const doc = CODE_TYPE_DOCUMENTATION[codeType as CodeType];
    summary += `### ${doc.name} (${count} geographies)\n`;
    summary += `${doc.description}\n`;
    summary += `*Managed by: ${doc.agencies.join(', ')}*\n\n`;
  });
  
  const fipsRequired = geography.filter(g => g.requiresFIPS).length;
  const hierarchical = geography.filter(g => g.isHierarchical).length;
  
  summary += `## Quick Stats\n`;
  summary += `- **${fipsRequired}/${geography.length}** geographies require FIPS codes\n`;
  summary += `- **${hierarchical}/${geography.length}** geographies are hierarchical\n`;
  summary += `- **${Object.keys(codeTypeCounts).length}** different code systems in use\n`;
  
  return summary;
}

/**
 * Tool description that includes code type context
 */
export const GEOGRAPHY_TOOL_DESCRIPTION = `
Fetch available geographic levels for Census datasets. Returns information about:

**Geographic Code Types:**
- **FIPS**: Standard federal codes (states, counties, places)
- **GNIS**: Geographic features (rivers, mountains, landmarks)  
- **CENSUS**: Statistical areas (tracts, block groups, urban areas)
- **EDUCATION**: School districts (elementary, secondary, unified)
- **STATE**: State-assigned codes (legislative districts, voting districts)
- **INCITS**: Modern standards for metro areas, congressional districts
- **HYBRID**: Combined systems (GEOIDs for small areas)

Each geography includes:
- Code type and management agency
- Whether FIPS codes are required for queries
- Hierarchical relationships
- Query construction guidance

Use this to understand what geographic levels are available and how to structure API queries for each dataset.
`.trim();

/**
 * Error messages with code type context
 */
export function createCodeTypeErrorMessage(
  requestedGeography: string, 
  availableGeographies: ParsedGeographyJson
): string {
  const availableByType = availableGeographies.reduce((acc, geo) => {
    if (!acc[geo.codeType]) acc[geo.codeType] = [];
    acc[geo.codeType].push(`${geo.code} (${geo.name})`);
    return acc;
  }, {} as Record<CodeType, string[]>);
  
  let message = `Geographic level '${requestedGeography}' not available in this dataset.\n\n`;
  
  message += "**Available geographies by code type:**\n";
  Object.entries(availableByType).forEach(([codeType, geos]) => {
    const doc = CODE_TYPE_DOCUMENTATION[codeType as CodeType];
    message += `\n**${doc.name}:**\n`;
    geos.forEach(geo => message += `  - ${geo}\n`);
  });
  
  return message;
}