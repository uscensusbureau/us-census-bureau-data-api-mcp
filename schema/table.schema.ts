import { z } from "zod";

const geographyPattern: RegExp = /^[a-zA-Z+\s]+:[*\d,]+$/;

export const baseFields = {
	dataset: z.string(),
	descriptive: z.boolean().optional(),
	predicates: z.record(z.string(), z.string()).optional()
}

export const yearField = {
	year: z.number()
}

export const groupField = {
	group: z.string()
}

export const variablesField = {
	variables: z.array(z.string()).max(50)
}

export const geographyFields = {
	for: z.string()
    .optional()
    .refine((val) => !val || geographyPattern.test(val), {
      message: "Must be in format 'geography-level:value1,value2' or 'geography-level:*', e.g., 'state:01,02' or 'county:*'."
  	})
  	.describe("Geography-level restriction, e.g. 'state:01'"),
  in: z.string()
    .optional()
    .refine((val) => !val || geographyPattern.test(val), {
      message: "Must be in format 'geography-level:value1,value2', e.g., 'state:01' or 'state:01,02'."
		})
    .describe("Geography-level restriction, e.g. 'state:01'"),
  ucgid: z.string().optional().describe("Alternative geography specification using UCGID, e.g., '0400000US06', '0400000US41'.")
};