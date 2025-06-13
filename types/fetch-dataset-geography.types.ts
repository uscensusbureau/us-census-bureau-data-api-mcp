import { z } from "zod";

import {
	FetchDatasetGeographyInputSchema
} from '../schema/dataset-geography.schema.js'

export type FetchDatasetGeographyArgs = z.infer<typeof FetchDatasetGeographyInputSchema>;