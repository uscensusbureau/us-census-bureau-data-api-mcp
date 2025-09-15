import { z } from 'zod'
import { BasePrompt } from '../../src/prompts/base.prompt'

export class ErrorThrowingPrompt extends BasePrompt<{ message: string }> {
  name = 'error-prompt'
  description = 'A prompt that throws errors for testing'
  arguments = [
    { name: 'message', description: 'Message parameter', required: true },
  ]

  get argsSchema() {
    return z.object({
      message: z.string(),
    })
  }

  handler(args: { message: string }) {
    // Always throw an error for testing error handling
    throw new Error(`Prompt execution failed: ${args}`)
  }
}

export class MockTestPrompt extends BasePrompt<{ message?: string }> {
  name = 'test-prompt-mock'
  description = 'A test prompt for testing purposes'
  arguments = [
    {
      name: 'message',
      description: 'Optional message parameter',
      required: false,
    },
  ]

  get argsSchema() {
    return z.object({
      message: z.string().optional(),
    })
  }

  handler(args: { message?: string }) {
    const message = args.message || 'default message'

    return {
      description: 'Test prompt response',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text' as const,
            text: `Processed: ${message}`,
          },
        },
      ],
    }
  }
}