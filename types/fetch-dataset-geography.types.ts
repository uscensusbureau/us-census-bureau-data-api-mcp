import { z } from "zod";

import {
	FetchDatasetGeographyInputSchema
} from '../schema/geography.schema.js'

export type FetchDatasetGeographyArgs = z.infer<typeof FetchDatasetGeographyInputSchema>;