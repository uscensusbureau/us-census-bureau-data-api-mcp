import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { BaseTool } from "./base.tool.js";
import { 
  FetchTableInputSchema,
  TableArgs, 
  TableSchema 
} from '../schema/table-group.schema.js';

import { 
  datasetValidator,
  validateGeographyArgs 
} from '../schema/validators.js';

export class FetchTableByGroupTool extends BaseTool<TableArgs > {
  name = "fetch-table-by-group";
  description = "Fetch a table by the group label.";
  inputSchema: Tool["inputSchema"] = TableSchema as Tool["inputSchema"];
  
  get argsSchema() {
    return FetchTableInputSchema.superRefine((args, ctx) => {
      //Check that the correct tool is used to fetch data
      const identifiedDataset = datasetValidator(args.dataset);

      if(identifiedDataset.tool !== this.name) {
        ctx.addIssue({
          path: ["dataset"],
          code: z.ZodIssueCode.custom,
          message: identifiedDataset.message
        });
      }

      validateGeographyArgs(args, ctx);
    });
  }

  constructor() {
    super();
    this.handler = this.handler.bind(this);
  }

  validateArgs(input: unknown) {
    return this.argsSchema.safeParse(input);
  }

  async handler(args: TableArgs) {
    const apiKey = process.env.CENSUS_API_KEY;
    if (!apiKey) {
      return this.createErrorResponse("Error: CENSUS_API_KEY is not set.");
    }

    const baseUrl = `https://api.census.gov/data/${args.year}/${args.dataset}`;


    const getParams = `group(${args.group})`;
    
    if ( args.for || args.ucgid ) {

      const query = new URLSearchParams({
        get: getParams
      });


      if (args.for) {
        query.append("for", args.for);
      }

      if (args.in) {
        query.append("in", args.in);
      }

      if (args.ucgid) {
        query.append("ucgid", args.ucgid);
      }

      if (args.predicates) {
        for (const [key, value] of Object.entries(args.predicates)) {
          query.append(key, value);
        }
      }

      const descriptive = args.descriptive?.toString() ?? "false";

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
    } else {
      return this.createErrorResponse(
        `Fetch failed: for or ucgid must be defined.`
      );
    }
  }
}