import { z } from "zod";

import {
	DatasetMetadataJsonSchema,
	DatasetSchema,
	DescribeDatasetInputSchema,
	MetadataResponseSchema
} from '../schema/describe-dataset.schema.js'

export type DatasetMetadataJson = z.infer<typeof DatasetMetadataJsonSchema>;
export type DatasetType = z.infer<typeof DatasetSchema>;
export type DescribeDatasetArgs = z.infer<typeof DescribeDatasetInputSchema>;
export type MetadataResponseType = z.infer<typeof MetadataResponseSchema>;