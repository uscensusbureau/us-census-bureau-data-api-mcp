export const SummaryTableSchema = {
  type: "object",
  properties: {
    dataset: {
      type: "string",
      description: "The dataset identifier (e.g., 'acs/acs1')",
    },
    year: {
      type: "number",
      description: "The year of the data",
    },
    variables: {
      type: "array",
      items: { type: "string" },
      description: "Array of variable codes to fetch",
    },
    for: {
      type: "object",
      items: { type: "string" },
      description: "Restricts geography to various levels and is required in most datasets, e.g. state: 01,02, county: 001 (optional)",
    },
    in: {
      type: "object",
      items: { type: "string" },
      description: "Restricts geography to areas state and smaller, e.g. state: 01  (optional)",
    },
    predicates: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Used to filter variable values, e.g. AGEGROUP=29, PAYANN=100000, time=2015 (optional)",
    },
    descriptive: {
      type: "boolean",
      description: "Add variable labels to the second row of the API results"
    },
    outputFormat: {
    	type: "string",
    	description: "Used to specify the output format, e.g. csv, json (optional)"
    }
  },
  required: ["dataset", "year", "variables"]
};