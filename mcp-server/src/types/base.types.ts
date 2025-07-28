import { TextContent } from "@modelcontextprotocol/sdk/types.js";

type JsonContent = {
  type: "json";
  json: object;
}

export type ToolContent = TextContent | JsonContent;

export interface StoredMCPTool {
  name: string;
  description: string;
  inputSchema: Tool["inputSchema"];
  argsSchema: z.ZodSchema<object, z.ZodTypeDef, object>;
  handler: (args: object) => Promise<{ content: ToolContent[] }>;
}