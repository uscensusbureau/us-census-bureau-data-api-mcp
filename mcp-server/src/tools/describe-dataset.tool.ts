import { Tool } from "@modelcontextprotocol/sdk/types.js";

import { BaseTool } from "./base.tool.js";

import { 
  DatasetType, 
  DatasetMetadataJsonSchema,
  DescribeDatasetArgs,
  DescribeDatasetInputSchema,
  MetadataResponseSchema,
  MetadataResponseType
} from '../schema/describe-dataset.schema.js';

import { ToolContent } from '../types/base.types.js';

export class DescribeDatasetTool extends BaseTool<DescribeDatasetArgs> {
  name = "describe-dataset";
  description = "Fetch metadata for a Census Bureau dataset.";
  
  inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      dataset: {
        type: "string",
        description: "Dataset identifier (e.g., 'acs/acs1', 'dec/sf1')"
      },
      year: {
        type: "number",
        description: "Data vintage year (e.g., 2022, 2020)"
      }
    },
    required: ["dataset"]
  };

  get argsSchema() {
    return DescribeDatasetInputSchema;
  }

  constructor() {
    super();
    this.handler = this.handler.bind(this);
  }

  /**
   * Filters metadata response to find the specific dataset match
   */
  private filterMetadataForDataset(metadata: MetadataResponseType, targetDataset: string): MetadataResponseType | null {
    metadata.dataset.forEach((dataset, index) => {
      const path = dataset.c_dataset.join('/');
      console.log(`  ${index}: ${path} (title: ${dataset.title.substring(0, 50)}...)`);
    });

    // Find the dataset where c_dataset path exactly matches the target
    const matchingDataset = metadata.dataset.find(dataset => {
      const datasetPath = dataset.c_dataset.join('/');
      const isMatch = datasetPath === targetDataset;
      console.log(`Checking: ${datasetPath} === ${targetDataset} ? ${isMatch}`);
      return isMatch;
    });

    console.log("Matching dataset:", matchingDataset);
    console.log("Target dataset:", targetDataset);

    if (!matchingDataset) {
      console.log(`❌ No exact match found for '${targetDataset}'`);
      console.log('Available datasets:', metadata.dataset.map(d => d.c_dataset.join('/')));
      return null;
    }

    return {
      ...metadata,
      dataset: [matchingDataset]
    };
  }

  /**
   * Updates dataset metadata to reflect the specific target dataset
   */
  private updateDatasetMetadataForTarget(dataset: DatasetType, targetDataset: string, originalDataset: string): DatasetType {
    const targetPath = targetDataset.split('/');
    const originalPath = originalDataset.split('/');
    
    // If we're dealing with a subset, update the relevant fields
    if (targetPath.length > originalPath.length) {
      const subsetPart = targetPath.slice(originalPath.length).join('/');
      
      return {
        ...dataset,
        title: `${dataset.title} - ${subsetPart.toUpperCase()}`,
        identifier: `${dataset.identifier}/${subsetPart}`,
        c_dataset: targetPath,
        description: `${dataset.description} (${subsetPart} subset)`,
        // Update API links to point to the specific subset
        c_variablesLink: dataset.c_variablesLink.replace(originalPath.join('/'), targetPath.join('/')),
        c_geographyLink: dataset.c_geographyLink.replace(originalPath.join('/'), targetPath.join('/')),
        c_documentationLink: dataset.c_documentationLink.replace(originalPath.join('/'), targetPath.join('/')),
        ...(dataset.c_examplesLink && {
          c_examplesLink: dataset.c_examplesLink.replace(originalPath.join('/'), targetPath.join('/'))
        }),
        ...(dataset.c_groupsLink && {
          c_groupsLink: dataset.c_groupsLink.replace(originalPath.join('/'), targetPath.join('/'))
        }),
        ...(dataset.c_tagsLink && {
          c_tagsLink: dataset.c_tagsLink.replace(originalPath.join('/'), targetPath.join('/'))
        }),
        // Update distribution access URL
        distribution: dataset.distribution.map(dist => ({
          ...dist,
          accessURL: dist.accessURL.replace(originalPath.join('/'), targetPath.join('/'))
        }))
      };
    }
    
    return dataset;
  }

  // Simplified formatting method that uses exact dataset matching
  private formatMetadataAsJson(metadata: MetadataResponseType, targetDataset: string): object {
    if (!metadata.dataset || metadata.dataset.length === 0) {
      return { error: "No dataset information found in the response" };
    }

    // Filter to get the exact matching dataset
    const filteredMetadata = this.filterMetadataForDataset(metadata, targetDataset);
    
    if (!filteredMetadata) {
      return { 
        error: `No exact match found for dataset '${targetDataset}'`,
        availableDatasets: metadata.dataset.map(d => d.c_dataset.join('/'))
      };
    }

    const dataset = filteredMetadata.dataset[0];
    
    return {
      "@context": metadata["@context"],
      "@type": "DatasetMetadata",
      dataset: {
        title: dataset.title,
        identifier: dataset.identifier,
        ...(dataset.c_vintage && { vintage: dataset.c_vintage }),
        datasetPath: dataset.c_dataset.join('/'),
        description: dataset.description,
        availability: {
          isAvailable: dataset.c_isAvailable,
          dataType: this.getDataTypeDescription(dataset),
          lastModified: dataset.modified,
          ...(dataset.c_isTimeseries && { isTimeseries: dataset.c_isTimeseries })
        },
        coverage: {
          ...(dataset.spatial && { spatial: dataset.spatial }),
          ...(dataset.temporal && { temporal: dataset.temporal })
        },
        resources: {
          variables: dataset.c_variablesLink,
          geography: dataset.c_geographyLink,
          documentation: dataset.c_documentationLink,
          examples: dataset.c_examplesLink || null,
          groups: dataset.c_groupsLink || null,
          tags: dataset.c_tagsLink || null,
          sorts: dataset.c_sorts_url || null
        },
        api: {
          endpoint: dataset.distribution[0]?.accessURL || null,
          format: dataset.distribution[0]?.format || null
        },
        contact: {
          name: dataset.contactPoint.fn,
          email: dataset.contactPoint.hasEmail
        },
        metadata: {
          keywords: dataset.keyword,
          license: dataset.license,
          publisher: dataset.publisher.name,
          bureauCode: dataset.bureauCode,
          programCode: dataset.programCode
        }
      }
    };
  }

  // Creates a human-readable description of the dataset type
  private getDataTypeDescription(dataset: DatasetType): string {
    if (dataset.c_isTimeseries) {
      return 'Timeseries';
    }
    
    const aggregateType = dataset.c_isAggregate ? 'Aggregated' : 'Individual';
    const structureType = dataset.c_isCube ? 'Cube' : 'Table';
    return `${aggregateType} ${structureType}`;
  }

  // Validates if the response matches the expected metadata structure
  private isValidMetadataResponse(data: unknown): data is MetadataResponseType {
    try {
      MetadataResponseSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }

  // Attempts to fetch metadata from multiple possible endpoints
  private async fetchMetadataFromEndpoints(args: DescribeDatasetArgs, apiKey: string) {
    const fetch = (await import("node-fetch")).default;
    let year = "";
    if(args.year){ year = `${args.year}/` }
    
    const baseUrl = `https://api.census.gov/data/${year}${args.dataset}`;
    
    // Strategy 1: Try the direct dataset endpoint first (primary method)
    const datasetUrl = `${baseUrl}?key=${apiKey}`;
    console.log(`Attempting to fetch metadata from dataset endpoint: ${datasetUrl}`);
    
    try {
      const datasetResponse = await fetch(datasetUrl);
      if (datasetResponse.ok) {
        const datasetData = await datasetResponse.json();
        console.log('Raw response type:', typeof datasetData);
        console.log('Raw response sample:', JSON.stringify(datasetData).substring(0, 200));
        
        if (this.isValidMetadataResponse(datasetData)) {
          console.log(`Successfully retrieved metadata from dataset endpoint`);
          return { data: datasetData, source: 'dataset endpoint' };
        } else {
          console.log('Response does not match expected metadata schema');
          // Check if it's data instead of metadata
          if (Array.isArray(datasetData) && datasetData.length > 0) {
            throw new Error(`Endpoint ${datasetUrl} returned data instead of metadata. This might be a data endpoint rather than a metadata endpoint.`);
          }
        }
      } else {
        console.log(`Dataset endpoint returned: ${datasetResponse.status} ${datasetResponse.statusText}`);
      }
    } catch (error) {
      console.log(`Dataset endpoint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }

    throw new Error(`Unable to retrieve metadata from any available endpoint for ${args.dataset} (${args.year}). This dataset may not have metadata available, or may be a data-only endpoint.`);
  }

  async handler(args: DescribeDatasetArgs): Promise<{ content: ToolContent[] }> {
    try {
      const apiKey = process.env.CENSUS_API_KEY;
      if (!apiKey) {
        return this.createErrorResponse("CENSUS_API_KEY is not set");
      }

      // Try to fetch metadata from available endpoints
      const result = await this.fetchMetadataFromEndpoints(args, apiKey);
      
      // Process the response based on its format
      if (this.isValidMetadataResponse(result.data)) {
        const formattedData = this.formatMetadataAsJson(result.data, args.dataset);
        
        // Add source information and any additional notes
        const responseWithSource = {
          ...formattedData,
          source: result.source,
          fetchedAt: new Date().toISOString(),
          ...(result.data.dataset[0].note && { note: result.data.dataset[0].note })
        };
        
        try {
          // Validate against the standard metadata schema
          const validatedResponse = DatasetMetadataJsonSchema.parse(responseWithSource);
          
          return {
            content: [
              {
                type: "text",
                text: `Metadata for ${args.dataset}${args.year ? ` (${args.year})` : ''}:\n\n${JSON.stringify(validatedResponse, null, 2)}`
              }
            ]
          };
        } catch (validationError) {
          // If validation fails, return the error details
          const validationMessage = validationError instanceof Error ? validationError.message : 'Validation failed';
          console.error('Schema validation failed:', validationMessage);
          
          return this.createErrorResponse(
            `Response validation failed: ${validationMessage}`
          );
        }
      } else {
        console.log("Error Made");
        return this.createErrorResponse(
            `Metadata validation failed.`
          );
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error in DescribeDatasetTool: ${errorMessage}`);
      
      return this.createErrorResponse(
        `Failed to fetch dataset metadata: ${errorMessage}`
      );
    }
  }
}