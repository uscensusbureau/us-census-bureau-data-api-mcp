import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { BaseTool } from "./base.js";
import { SummaryTableSchema } from '../schema/summary-table.schema.js';
import { datasetValidator } from '../schema/validators.js';

type SummaryArgs = {
  dataset: string;
  year: number;
  variables: string[];
  for?: string;
  in?: string;
  predicates?: Record<string, string>;
  descriptive?: boolean;
  outputFormat?: string;
}

export class FetchSummaryTableTool extends BaseTool<SummaryArgs> {
  name = "fetch-summary-table";
  description = "Fetch a summary table from the Census Bureau’s API";
  inputSchema: Tool["inputSchema"] = SummaryTableSchema as Tool["inputSchema"];
  
  get argsSchema() {
    return z.object({
      dataset: z.string(),
      year: z.number(),
      variables: z.array(z.string()),
      for: z.string()
        .optional()
        .refine((val) => {
          if (!val) return true;
          return /^[a-zA-Z+\s]+:[*\d,]+$/.test(val);
        }, {
          message: "for parameter must be in format 'geography-level:value1,value2' or 'geography:*', e.g. 'state:01,02' or 'county:*'"
      }),
      in: z.string()
        .optional()
        .refine((val) => {
          if (!val) return true;
          return /^[a-zA-Z+\s]+:[*\d,]+$/.test(val);
        }, {
          message: "in parameter must be in format 'geography-level:value1,value2', e.g. 'state:01' or 'state:01,02'"
      }),
      predicates: z.record(z.string(), z.string()).optional(),
      descriptive: z.boolean().optional(),
      outputFormat: z.string().optional()
    }).superRefine((args, ctx) => {
      const identifiedDataset = datasetValidator(args.dataset);

      if(identifiedDataset.tool !== this.name) {
        ctx.addIssue({
          path: ["dataset"],
          code: z.ZodIssueCode.custom,
          message: identifiedDataset.message
        });
      }
    });
  }

  constructor() {
    super();
    this.handler = this.handler.bind(this);
  }

  validateArgs(input: unknown) {
    return this.argsSchema.safeParse(input);
  }

  async handler(args: SummaryArgs) {
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