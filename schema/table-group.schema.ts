import { z } from "zod";

import { 
  baseFields,
  geographyFields,
  groupField,
  yearField
} from './table.schema.js';

export const TableSchema = {
  type: "object",
  properties: {
    dataset: {
      type: "string",
      description: "The dataset identifier.",
      examples: [
        'acs/acs1'
      ]
    },
    year: {
      type: "number",
      description: "The year or vintage of the data.",
      examples: [
        1987
      ]
    },
    group: {
      type: "string",
      description: "The group label that is used to fetch the entire table.",
      examples: [
        'S0101'
      ]
    },
    for: {
      type: "string",
      description: "Geography restriction as comma-separated values. Required if 'ucgid' not defined.",
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
      description: "Parent geography restriction as comma-separated values",
      examples: [
        "state:01",
        "state:01,02",
        "county:075"
      ]
    },
    ucgid: {
      type: "string",
      description: "Alternative geography specification using Uniform Census Geography Identifier (UCGID). Required if 'for' not defined.",
      examples: [
        "0400000US06", 
        "0400000US41"
      ]
    },
    predicates: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Used to filter table results."
    },
    descriptive: {
      type: "boolean",
      description: "Add variable labels to the second row of the API results.",
      examples: [
        'true',
        'false'
      ]
    }
  },
  required: ["dataset", "year", "group"]
};

export const FetchTableInputSchema = z.object({
  ...baseFields,
  ...groupField,
  ...yearField,
  ...geographyFields
});

export type TableArgs = z.infer<typeof FetchTableInputSchema>;