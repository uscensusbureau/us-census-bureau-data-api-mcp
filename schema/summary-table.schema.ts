export const SummaryTableSchema = {
  type: "object",
  properties: {
    dataset: {
      type: "string",
      description: "The dataset identifier (e.g., 'acs/acs1')",
    },
    year: {
      type: "number",
      description: "The year or vintage of the data, e.g. 1987",
    },
    variables: {
      type: "array",
      items: { type: "string" },
      description: "Array of variable codes to fetch",
    },
    for: {
      type: "string",
      description: "Geography restriction as comma-separated values, e.g. 'state:01,02' or 'county:001' or 'state:*' (optional)",
      examples: [
        "state:*",
        "state:01,02,06", 
        "county:001",
        "county:*",
        "place:12345"
      ]
    },
    in: {
      type: "string", 
      description: "Parent geography restriction as comma-separated values, e.g. 'state:01' or 'state:01,02' (optional)",
      examples: [
        "state:01",
        "state:01,02",
        "county:075"
      ]
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