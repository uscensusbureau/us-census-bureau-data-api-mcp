import { z } from "zod";


//Properties
export const baseProperties = {
	dataset: {
    type: "string",
    description: "The dataset identifier.",
    examples: [
      'acs/acs1'
    ]
  },
  descriptive: {
    type: "boolean",
    description: "Add variable labels to the second row of the API results.",
    examples: [
      'true',
      'false'
    ]
  },
  predicates: {
    type: "object",
    additionalProperties: { type: "string" },
    description: "Used to filter table results."
  }
}

export const yearProperty = {
	year: {
	  type: "number",
	  description: "The year or vintage of the data.",
	  examples: [
	    1987
	  ]
	}	
}

export const getProperties = {
	get: {
		type: "object",
		description: "The group and variables that should be fetched.",
		properties: {
			variables: {
				type: "array",
				items: { type: "string" },
				description: "The variables (or rows) that should be fetched from a given table. A max of 50 variables can be passed.",
				examples: [
			    ['B24022_060E', 'B19001B_014E', 'C02014_002E']
			  ]
			},
			group: {
			  type: "string",
			  description: "The group label that is used to fetch the entire table.",
			  examples: [
			    'S0101'
			  ]
			}
		}
	}
}

export const geoProperties = {
	for: {
	  type: "string",
	  description: "Geography restriction as comma-separated values. Required if 'ucgid' not defined.",
	  examples: [
	    "state:*",
	    "state:01,02,06", 
	    "county:001",
	    "county:*",
	    "tract:*",
	    "place:12345"
	  ]
	},
	in: {
	  type: "string", 
	  description: "Parent geography restriction as comma-separated values",
	  examples: [
	    "state:01",
	    "state:01,02",
	    "county:075",
	    "state:01 county:001",
	    "state:01%20county:001",
	  ]
	},
	ucgid: {
	  type: "string",
	  description: "Alternative geography specification using Uniform Census Geography Identifier (UCGID). Required if 'for' not defined.",
	  examples: [
	    "0400000US06", 
	    "0400000US41"
	  ]
	}
}


//Fields
const geographyPatternFor: RegExp = /^[a-zA-Z+\s]+:[*\d,]+$/;
const geographyPatternIn: RegExp = /^[a-zA-Z+\s]+:[*\d,]+(?:(?:\s|%20)[a-zA-Z+\s]+:[*\d,]+)*$/;

export const baseFields = {
	dataset: z.string(),
	descriptive: z.boolean().optional(),
	predicates: z.record(z.string(), z.string()).optional()
}

export const yearField = {
	year: z.number()
}

export const getFields = {
	get: z.object({
		group: z.string().optional(),
		variables: z.array(z.string()).max(50).optional()
	})
}

export const groupField = {
	group: z.string().optional()
}

export const variablesField = {
	variables: z.array(z.string()).max(50).optional()
}

export const geoFields = {
	for: z.string()
    .optional()
    .refine((val) => !val || geographyPatternFor.test(val), {
      message: "Must be in format 'geography-level:value1,value2' or 'geography-level:*', e.g., 'state:01,02' or 'county:*'."
  	})
  	.describe("Geography-level restriction, e.g. 'state:01'"),
  in: z.string()
    .optional()
    .refine((val) => !val || geographyPatternIn.test(val), {
      message: "Must be in format 'geography-level:value1' or 'geography-level:value1 geography-level:value2', e.g., 'state:01', 'state:01 county:001', or 'state:01%20county:001'."
		})
    .describe("Geography-level restriction, e.g. 'state:01'"),
  ucgid: z.string().optional().describe("Alternative geography specification using UCGID, e.g., '0400000US06', '0400000US41'.")
};