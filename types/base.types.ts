import { TextContent } from "@modelcontextprotocol/sdk/types.js";

type JsonContent = {
  type: "json";
  json: object;
}

export type ToolContent = TextContent | JsonContent;