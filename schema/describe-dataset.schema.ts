import { z } from "zod";

// Input schema for the tool
export const DescribeDatasetInputSchema = z.object({
  dataset: z.string().describe("Dataset identifier (e.g., 'acs/acs1')"),
  year: z.number().describe("Data vintage year").optional()
});

// Contact point schema
const ContactPointSchema = z.object({
  fn: z.string(),
  hasEmail: z.string()
});

// Distribution schema
const DistributionSchema = z.object({
  "@type": z.string(),
  accessURL: z.string(),
  description: z.string(),
  format: z.string(),
  mediaType: z.string(),
  title: z.string()
});

// Publisher schema - updated to handle nested organizations
const PublisherSchema = z.object({
  "@type": z.string(),
  name: z.string(),
  subOrganizationOf: z.any().optional()
});

// Updated Dataset schema to match actual Census API responses
export const DatasetSchema = z.object({
  "@type": z.string(),
  title: z.string(),
  identifier: z.string(),
  description: z.string(),
  accessLevel: z.string(),
  bureauCode: z.array(z.string()),
  contactPoint: ContactPointSchema,
  distribution: z.array(DistributionSchema),
  keyword: z.array(z.string()),
  license: z.string(),
  modified: z.string(),
  programCode: z.array(z.string()),
  references: z.array(z.string()),
  publisher: PublisherSchema,
  
  // Optional fields that may not always be present
  spatial: z.string().optional(),
  temporal: z.string().optional(),
  
  // Dataset fields
  c_dataset: z.array(z.string()),
  c_geographyLink: z.string(),
  c_variablesLink: z.string(),
  c_documentationLink: z.string(),
  c_isAvailable: z.boolean(),
  
  // Optional fields
  c_vintage: z.number().optional(),
  c_isAggregate: z.boolean().optional(),
  c_isCube: z.boolean().optional(),
  c_isTimeseries: z.boolean().optional(),
  c_tagsLink: z.string().optional(),
  c_examplesLink: z.string().optional(),
  c_groupsLink: z.string().optional(),
  c_sorts_url: z.string().optional(),
  note: z.string().optional()
});

// Metadata response schema
export const MetadataResponseSchema = z.object({
  "@context": z.string(),
  "@id": z.string(),
  "@type": z.string(),
  conformsTo: z.string(),
  describedBy: z.string(),
  dataset: z.array(DatasetSchema)
});

// Schema for the formatted output
export const DatasetMetadataJsonSchema = z.object({
  '@context': z.string(),
  '@type': z.literal('DatasetMetadata'),
  dataset: z.object({
    title: z.string(),
    identifier: z.string(),
    vintage: z.number().optional(), // Made optional since timeseries might not have vintage
    datasetPath: z.string(),
    description: z.string(),
    availability: z.object({
      isAvailable: z.boolean(),
      dataType: z.string(),
      lastModified: z.string().optional(),
      isTimeseries: z.boolean().optional()
    }),
    coverage: z.object({
      spatial: z.string().optional(), // Made optional
      temporal: z.string().optional() // Made optional
    }),
    resources: z.object({
      variables: z.string(),
      geography: z.string(),
      documentation: z.string(),
      examples: z.string().nullable().optional(),
      groups: z.string().nullable().optional(),
      tags: z.string().nullable().optional(),
      sorts: z.string().nullable().optional()
    }),
    api: z.object({
      endpoint: z.string().nullable(),
      format: z.string().nullable()
    }),
    contact: z.object({
      name: z.string(),
      email: z.string()
    }),
    metadata: z.object({
      keywords: z.array(z.string()),
      license: z.string(),
      publisher: z.string(),
      bureauCode: z.array(z.string()),
      programCode: z.array(z.string())
    })
  }),
  source: z.string(),
  fetchedAt: z.string(),
  note: z.string().optional()
});