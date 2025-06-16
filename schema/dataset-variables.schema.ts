import { z } from 'zod';

//Argument Validation 
export const FetchDatasetVariablesInputSchema = z.object({
  dataset: z.string().describe("Dataset identifier (e.g., 'acs/acs1')"),
  year: z.number().describe("The year or vintage of the data, e.g. 1987").optional()
});

export const FetchDatasetVariablesArgsSchema = {
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

//API Response Validation
const DateTimeSpecSchema = z.object({
  year: z.boolean().optional(),
  quarter: z.boolean().optional(),
  month: z.boolean().optional(),
  day: z.boolean().optional(),
});

const ValueRangeSchema = z.object({
  min: z.string(),
  max: z.string(),
  description: z.string(),
});

const ValuesSchema = z.object({
  item: z.record(z.string(), z.string()).optional(),
  range: z.array(ValueRangeSchema).optional(),
});

const VariableSchema = z.object({
  label: z.string(),
  concept: z.string().optional(),
  required: z.union([z.string(), z.boolean()]).optional(),
  predicateType: z.enum([
  	'fips-for', 'fips-in', 'datetime', 'int', 'float', 'lat', 'long', 'string', 'ucgid'
  	]).optional(),
  group: z.string(),
  limit: z.number(),
  predicateOnly: z.boolean().optional(),
  'suggested-weight': z.string().optional(),
  attributes: z.string().optional(),
  datetime: DateTimeSpecSchema.optional(),
  values: ValuesSchema.optional(),
});

type FullVariable = z.infer<typeof VariableSchema>;
type FullVariablesResponse = { variables: Record<string, FullVariable> };

// Strategy 1: Variable names only (most aggressive reduction)
export function getVariableNamesOnly(response: FullVariablesResponse): string[] {
  return Object.keys(response.variables);
}

// Strategy 2: Names + labels (essential info)
export interface VariableBasic {
  name: string;
  label: string;
}

export function getVariableBasics(response: FullVariablesResponse): VariableBasic[] {
  return Object.entries(response.variables).map(([name, variable]) => ({
    name,
    label: variable.label,
  }));
}

// Strategy 3: Core metadata without values
export interface VariableCore {
  name: string;
  label: string;
  predicateType?: string;
  group: string;
  concept?: string;
}

export function getVariableCores(response: FullVariablesResponse): VariableCore[] {
  return Object.entries(response.variables).map(([name, variable]) => ({
    name,
    label: variable.label,
    predicateType: variable.predicateType,
    group: variable.group,
    concept: variable.concept,
  }));
}

// Strategy 4: Group-based summary
export interface GroupSummary {
  group: string;
  concept?: string;
  variableCount: number;
  variables: string[];
  predicateTypes: string[];
}

export function getGroupSummary(response: FullVariablesResponse): GroupSummary[] {
  const groups = new Map<string, {
    concept?: string;
    variables: string[];
    predicateTypes: Set<string>;
  }>();

  Object.entries(response.variables).forEach(([name, variable]) => {
    const groupKey = variable.group;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        concept: variable.concept,
        variables: [],
        predicateTypes: new Set(),
      });
    }
    const group = groups.get(groupKey)!;
    group.variables.push(name);
    
    if (variable.predicateType) {
      group.predicateTypes.add(variable.predicateType);
    }
  });

  return Array.from(groups.entries()).map(([group, data]) => ({
    group,
    concept: data.concept,
    variableCount: data.variables.length,
    variables: data.variables,
    predicateTypes: Array.from(data.predicateTypes),
  }));
}

// Strategy 5: Concept-based clustering
export interface ConceptCluster {
  concept: string;
  variableCount: number;
  groups: string[];
  sampleVariables: string[]; // First 5 variables as examples
}

export function getConceptClusters(response: FullVariablesResponse): ConceptCluster[] {
  const concepts = new Map<string, {
    groups: Set<string>;
    variables: string[];
  }>();

  Object.entries(response.variables).forEach(([name, variable]) => {
    const conceptKey = variable.concept || 'Uncategorized';
    if (!concepts.has(conceptKey)) {
      concepts.set(conceptKey, {
        groups: new Set(),
        variables: [],
      });
    }
    const concept = concepts.get(conceptKey)!;
    concept.groups.add(variable.group);
    concept.variables.push(name);
  });

  return Array.from(concepts.entries()).map(([concept, data]) => ({
    concept,
    variableCount: data.variables.length,
    groups: Array.from(data.groups),
    sampleVariables: data.variables.slice(0, 5),
  }));
}

// Strategy 6: Smart filtering based on relevance
export interface FilterOptions {
  excludeGroups?: string[];
  includePredicateTypes?: string[];
  excludePredicateTypes?: string[];
  maxVariablesPerGroup?: number;
  keywordFilter?: string;
}

export function getFilteredVariables(
  response: FullVariablesResponse, 
  options: FilterOptions = {}
): VariableCore[] {
  let filtered = Object.entries(response.variables);

  // Filter by groups
  if (options.excludeGroups?.length) {
    filtered = filtered.filter(([, variable]) => 
      !options.excludeGroups!.includes(variable.group)
    );
  }

  // Filter by predicate types
  if (options.includePredicateTypes?.length) {
    filtered = filtered.filter(([, variable]) => 
      variable.predicateType && options.includePredicateTypes!.includes(variable.predicateType)
    );
  }

  // Filter by excluded predicate types
  if (options.excludePredicateTypes?.length) {
    filtered = filtered.filter(([, variable]) => 
      !variable.predicateType || !options.excludePredicateTypes!.includes(variable.predicateType)
    );
  }

  // Keyword filtering
  if (options.keywordFilter) {
    const keyword = options.keywordFilter.toLowerCase();
    filtered = filtered.filter(([name, variable]) => 
      name.toLowerCase().includes(keyword) || 
      variable.label.toLowerCase().includes(keyword) ||
      variable.concept?.toLowerCase().includes(keyword)
    );
  }

  // Limit per group
  if (options.maxVariablesPerGroup) {
    const groupCounts = new Map<string, number>();
    filtered = filtered.filter(([, variable]) => {
      const count = groupCounts.get(variable.group) || 0;
      if (count < options.maxVariablesPerGroup!) {
        groupCounts.set(variable.group, count + 1);
        return true;
      }
      return false;
    });
  }

  return filtered.map(([name, variable]) => ({
    name,
    label: variable.label,
    predicateType: variable.predicateType,
    group: variable.group,
    concept: variable.concept,
  }));
}

// Strategy 7: Progressive disclosure helper
export class VariableExplorer {
  private fullResponse: FullVariablesResponse;
  
  constructor(response: FullVariablesResponse) {
    this.fullResponse = response;
  }

  // Start with high-level overview
  getOverview() {
    const total = Object.keys(this.fullResponse.variables).length;
    const groups = getGroupSummary(this.fullResponse);
    const concepts = getConceptClusters(this.fullResponse);
    
    return {
      totalVariables: total,
      totalGroups: groups.length,
      totalConcepts: concepts.length,
      largestGroups: groups
        .sort((a, b) => b.variableCount - a.variableCount)
        .slice(0, 10),
      conceptSummary: concepts
        .sort((a, b) => b.variableCount - a.variableCount)
        .slice(0, 10),
    };
  }

  // Drill down into specific groups
  getGroupDetails(groupName: string): VariableCore[] {
    return Object.entries(this.fullResponse.variables)
      .filter(([, variable]) => variable.group === groupName)
      .map(([name, variable]) => ({
        name,
        label: variable.label,
        predicateType: variable.predicateType,
        group: variable.group,
        concept: variable.concept,
      }));
  }

  // Get full details for specific variables
  getVariableDetails(variableNames: string[]): Record<string, FullVariable> {
    const result: Record<string, FullVariable> = {};
    variableNames.forEach(name => {
      if (this.fullResponse.variables[name]) {
        result[name] = this.fullResponse.variables[name];
      }
    });
    return result;
  }
}

/*
export const USAGE_EXAMPLES = {
  // ~100-500 bytes depending on variable count
  variableNamesOnly: `
    const names = getVariableNamesOnly(response);
    // Result: ["DRIVESP", "WKW", "WORKSTAT", ...]
  `,
  
  // ~200-1000 bytes per 100 variables
  variableBasics: `
    const basics = getVariableBasics(response);
    // Result: [{ name: "DRIVESP", label: "Number of vehicles..." }, ...]
  `,
  
  // ~500-2000 bytes per 100 variables
  variableCores: `
    const cores = getVariableCores(response);
    // Includes name, label, predicateType, group, concept
  `,
  
  // Dramatically reduced for large datasets
  groupSummary: `
    const summary = getGroupSummary(response);
    // Groups variables by category with counts
  `,
  
  // Best for exploration workflow
  progressive: `
    const explorer = new VariableExplorer(response);
    const overview = explorer.getOverview();
    const groupDetails = explorer.getGroupDetails("EC1242SXSB05");
    const fullDetails = explorer.getVariableDetails(["DRIVESP", "WKW"]);
  `
};
*/

export const VariablesJsonSchema = z.object({
  variables: z.record(z.string(), VariableSchema),
});

//Helper Functions for Validation and Parsing
export function validateJsonResponse(data: unknown): VariablesJsonResponse {
  return VariablesJsonSchema.parse(data);
}

//Export Types for Validation
export type FetchDatasetVariablesArgs = z.infer<typeof FetchDatasetVariablesInputSchema>;
export type VariablesJsonResponse = z.infer<typeof VariablesJsonSchema>;