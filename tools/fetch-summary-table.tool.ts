import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BaseTool } from "./base.js";

export class FetchSummaryTableTool extends BaseTool {
  name = "fetch-summary-table";
  description = "Fetch a summary table from the Census Bureau’s API";
  
  inputSchema: Tool["inputSchema"] = {
    type: "object",
    properties: {
      dataset: {
        type: "string",
        description: "The dataset identifier (e.g., 'acs/acs1')",
      },
      year: {
        type: "number",
        description: "The year of the data",
      },
      variables: {
        type: "array",
        items: { type: "string" },
        description: "Array of variable codes to fetch",
      },
      for: {
        type: "object",
        items: { type: "string" },
        description: "Restricts geography to various levels and is required in most datasets, e.g. state: 01,02, county: 001 (optional)",
      },
      in: {
        type: "object",
        items: { type: "string" },
        description: "Restricts geography to areas state and smaller, e.g. state: 01  (optional)",
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
    required: ["dataset", "year", "variables"],
  };

  argsSchema = z.object({
    dataset: z.string(),
    year: z.number(),
    variables: z.array(z.string()),
    for: z.string().optional(),
  	in: z.string().optional(),
  	predicates: z.record(z.string(), z.string()).optional(),
    descriptive: z.boolean().optional(),
  	outputFormat: z.string().optional()
  });

  async handler(args: z.infer<typeof this.argsSchema>) {

    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) {
      return this.createErrorResponse("Error: CENSUS_API_KEY is not set.");
    }

    const baseUrl = `https://api.census.gov/data/${args.year}/${args.dataset}`;
    const query = new URLSearchParams({
      get: args.variables.join(","),
      ...(args.outputFormat ? { outputFormat: args.outputFormat } : {})
    });

    const descriptive = args.descriptive?.toString() ?? "false";

    if (args.for) {
      query.append("for", args.for);
    }

    if (args.in) {
      query.append("in", args.in);
    }

		if (args.predicates) {
		  for (const [key, value] of Object.entries(args.predicates)) {
		    query.append(key, value);
		  }
		}

    query.append("descriptive", descriptive)

    query.append("key", apiKey);

    const url = `${baseUrl}?${query.toString()}`;

    try {
      const fetch = (await import("node-fetch")).default;
      const res = await fetch(url);
      console.log(`URL Attempted: ${url}`);
      
      if (!res.ok) {
        return this.createErrorResponse(
          `Census API error: ${res.status} ${res.statusText}`
        );
      }

      const data = (await res.json()) as string[][];
      const [headers, ...rows] = data;
      const output = rows
        .map((row) => headers.map((h, i) => `${h}: ${row[i]}`).join(", "))
        .join("\n");

      return this.createSuccessResponse(
        `Response from ${args.dataset}:\n${output}`
      );
    } catch (err) {
      return this.createErrorResponse(
        `Fetch failed: ${(err as Error).message}`
      );
    }
  }
}