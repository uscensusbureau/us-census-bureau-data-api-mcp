import { z } from 'zod'
import { Prompt } from '@modelcontextprotocol/sdk/types.js'

export interface MCPPrompt<Args extends object = object> {
  name: string
  description: string
  arguments?: Prompt['arguments']
  argsSchema: z.ZodSchema<Args, z.ZodTypeDef, Args>
  handler: (args: Args) => Promise<{
    description: string
    messages: Array<{
      role: string
      content: { type: string; text: string }
    }>
  }>
}

interface StoredMCPPrompt {
  name: string
  description: string
  arguments?: Prompt['arguments']
  argsSchema: z.ZodSchema<object, z.ZodTypeDef, object>
  handler: (args: object) => Promise<{
    description: string
    messages: Array<{
      role: string
      content: { type: string; text: string }
    }>
  }>
}

export abstract class BasePrompt<Args extends object>
  implements MCPPrompt<Args>
{
  abstract name: string
  abstract description: string
  abstract arguments?: Prompt['arguments']
  abstract get argsSchema(): z.ZodType<Args, z.ZodTypeDef, Args>
  abstract handler(args: Args): Promise<{
    description: string
    messages: Array<{
      role: string
      content: { type: string; text: string }
    }>
  }>

  protected createPromptMessage(text: string, role: string = 'user') {
    return {
      role,
      content: {
        type: 'text' as const,
        text,
      },
    }
  }

  protected createPromptResponse(
    description: string,
    text: string,
    role: string = 'user',
  ) {
    return {
      description,
      messages: [this.createPromptMessage(text, role)],
    }
  }
}

export class PromptRegistry {
  private prompts = new Map<string, StoredMCPPrompt>()

  register<T extends object>(prompt: MCPPrompt<T>): void {
    if (this.prompts.has(prompt.name)) {
      throw new Error(`Prompt '${prompt.name}' is already registered`)
    }

    // Store as type-erased version
    const storedPrompt: StoredMCPPrompt = {
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
      argsSchema: prompt.argsSchema as z.ZodSchema<
        object,
        z.ZodTypeDef,
        object
      >,
      handler: prompt.handler as (args: object) => Promise<{
        description: string
        messages: Array<{
          role: string
          content: { type: string; text: string }
        }>
      }>,
    }
    this.prompts.set(prompt.name, storedPrompt)
  }

  getAll(): StoredMCPPrompt[] {
    return Array.from(this.prompts.values())
  }

  get(name: string): StoredMCPPrompt | undefined {
    return this.prompts.get(name)
  }

  has(name: string): boolean {
    return this.prompts.has(name)
  }
}
