import { Tool } from "@modelcontextprotocol/sdk/types.js";

import { BaseTool } from "./base.js";
import { 
	FetchDatasetGeographyArgsSchema,
	FetchDatasetGeographyInputSchema,
	GeographyJsonSchema,
	parseGeographyJson
} from '../schema/dataset-geography.schema.js';

import { FetchDatasetGeographyArgs } from '../types/fetch-dataset-geography.types.js';
import { ToolContent } from '../types/base.types.js';


export class FetchDatasetGeographyTool extends BaseTool<FetchDatasetGeographyArgs> {
  name = "fetch-dataset-geography";
  description = "Fetch available geographies for filtering a dataset.";

  inputSchema: Tool["inputSchema"] = FetchDatasetGeographyArgsSchema as Tool["inputSchema"];

  get argsSchema() {
    return FetchDatasetGeographyInputSchema;
  }

  constructor() {
    super();
    this.handler = this.handler.bind(this);
  }

  async handler(args: FetchDatasetGeographyArgs): Promise<{ content: ToolContent[] }> {
		try {
	  	const apiKey = process.env.CENSUS_API_KEY;
	    if (!apiKey) {
	      return this.createErrorResponse("Error: CENSUS_API_KEY is not set.");
	    }

	    const fetch = (await import("node-fetch")).default;
	    let year = ""; //Start with a blank year
	    if(args.year){ year = `${args.year}/` } // Add the year if it is present in the input args
	    
	    const baseUrl = `https://api.census.gov/data/${year}${args.dataset}/geography.json`; // Construct the URL
			const geographyUrl = `${baseUrl}?key=${apiKey}`; // Add the API Key


		  const geographyResponse = await fetch(geographyUrl);

		  if (geographyResponse.ok) {
		    const geographyData = await geographyResponse.json();

		    try {
		    	const validatedData = GeographyJsonSchema.parse(geographyData);
		    	const parsedGeographyData = parseGeographyJson(validatedData);

		    	return {
            content: [
              {
                type: "text",
                text: `Available geographies for ${args.dataset}${args.year ? ` (${args.year})` : ''}:\n\n${JSON.stringify(parsedGeographyData, null, 2)}`
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
		  	console.log(geographyResponse.status);
		    return this.createErrorResponse(
        `Geography endpoint returned: ${geographyResponse.status} ${geographyResponse.statusText}`
      );
		  }
		} catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return this.createErrorResponse(
        `Failed to fetch dataset geography levels: ${errorMessage}`
      );
    }
  }
}