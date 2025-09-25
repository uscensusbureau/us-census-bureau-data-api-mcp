import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  BasePrompt,
  PromptRegistry,
  MCPPrompt,
} from '../../src/prompts/base.prompt'

// Test implementation of BasePrompt
class TestPrompt extends BasePrompt<{ message: string; count?: number }> {
  name = 'test-prompt'
  description = 'A test prompt for testing purposes'
  arguments = [
    { name: 'message', description: 'The message to process', required: true },
    {
      name: 'count',
      description: 'Number of times to repeat',
      required: false,
    },
  ]

  get argsSchema() {
    return z.object({
      message: z.string(),
      count: z.number().optional(),
    })
  }

  async handler(args: { message: string; count?: number }) {
    const count = args.count || 1
    const repeatedMessage = Array(count).fill(args.message).join(' ')

    return {
      description: `Processed message ${count} time(s)`,
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text' as const,
            text: repeatedMessage,
          },
        },
      ],
    }
  }
}

// Another test implementation for variety
class SimplePrompt extends BasePrompt<{ text: string }> {
  name = 'simple-prompt'
  description = 'A simple prompt'

  get argsSchema() {
    return z.object({
      text: z.string(),
    })
  }

  async handler(args: { text: string }) {
    return {
      description: 'Simple response',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text' as const,
            text: args.text,
          },
        },
      ],
    }
  }
}

// Mock prompt for direct interface testing
const mockPrompt: MCPPrompt<{ value: number }> = {
  name: 'mock-prompt',
  description: 'Mock prompt for testing',
  arguments: [{ name: 'value', description: 'A number value', required: true }],
  argsSchema: z.object({ value: z.number() }),
  handler: (args) => ({
    description: 'Mock response',
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Value: ${args.value}` },
      },
    ],
  }),
}

describe('BasePrompt', () => {
  let testPrompt: TestPrompt

  beforeEach(() => {
    testPrompt = new TestPrompt()
  })

  describe('abstract properties', () => {
    it('should have required properties', () => {
      expect(testPrompt.name).toBe('test-prompt')
      expect(testPrompt.description).toBe('A test prompt for testing purposes')
      expect(testPrompt.arguments).toHaveLength(2)
      expect(testPrompt.argsSchema).toBeDefined()
    })

    it('should have proper arguments structure', () => {
      expect(testPrompt.arguments![0]).toEqual({
        name: 'message',
        description: 'The message to process',
        required: true,
      })
      expect(testPrompt.arguments![1]).toEqual({
        name: 'count',
        description: 'Number of times to repeat',
        required: false,
      })
    })

    it('should have working schema validation', () => {
      const validArgs = { message: 'test', count: 2 }
      const result = testPrompt.argsSchema.parse(validArgs)
      expect(result).toEqual(validArgs)

      expect(() => testPrompt.argsSchema.parse({ count: 2 })).toThrow()
      expect(() => testPrompt.argsSchema.parse({ message: 123 })).toThrow()
    })
  })

  describe('createPromptMessage', () => {
    it('should create message with default role', () => {
      const message = testPrompt['createPromptMessage']('Hello world')
      expect(message).toEqual({
        role: 'user',
        content: {
          type: 'text',
          text: 'Hello world',
        },
      })
    })

    it('should create message with custom role', () => {
      const message = testPrompt['createPromptMessage'](
        'Hello world',
        'assistant',
      )
      expect(message).toEqual({
        role: 'assistant',
        content: {
          type: 'text',
          text: 'Hello world',
        },
      })
    })
  })

  describe('createPromptResponse', () => {
    it('should create response with default role', () => {
      const response = testPrompt['createPromptResponse'](
        'Test description',
        'Response text',
      )
      expect(response).toEqual({
        description: 'Test description',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Response text',
            },
          },
        ],
      })
    })

    it('should create response with custom role', () => {
      const response = testPrompt['createPromptResponse'](
        'Test description',
        'Response text',
        'assistant',
      )
      expect(response).toEqual({
        description: 'Test description',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'Response text',
            },
          },
        ],
      })
    })
  })

  describe('handler', () => {
    it('should handle args with default count', async () => {
      const result = await testPrompt.handler({ message: 'hello' })
      expect(result).toEqual({
        description: 'Processed message 1 time(s)',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'hello',
            },
          },
        ],
      })
    })

    it('should handle args with custom count', async () => {
      const result = await testPrompt.handler({ message: 'hi', count: 3 })
      expect(result).toEqual({
        description: 'Processed message 3 time(s)',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'hi hi hi',
            },
          },
        ],
      })
    })
  })
})

describe('PromptRegistry', () => {
  let registry: PromptRegistry

  beforeEach(() => {
    registry = new PromptRegistry()
  })

  describe('register', () => {
    it('should register a prompt successfully', () => {
      const testPrompt = new TestPrompt()
      expect(() => registry.register(testPrompt)).not.toThrow()
      expect(registry.has('test-prompt')).toBe(true)
    })

    it('should register a mock prompt successfully', () => {
      expect(() => registry.register(mockPrompt)).not.toThrow()
      expect(registry.has('mock-prompt')).toBe(true)
    })

    it('should throw error when registering duplicate prompt names', () => {
      const testPrompt1 = new TestPrompt()
      const testPrompt2 = new TestPrompt()

      registry.register(testPrompt1)
      expect(() => registry.register(testPrompt2)).toThrow(
        "Prompt 'test-prompt' is already registered",
      )
    })

    it('should allow different prompts with different names', () => {
      const testPrompt = new TestPrompt()
      const simplePrompt = new SimplePrompt()

      expect(() => {
        registry.register(testPrompt)
        registry.register(simplePrompt)
      }).not.toThrow()

      expect(registry.has('test-prompt')).toBe(true)
      expect(registry.has('simple-prompt')).toBe(true)
    })
  })

  describe('getAll', () => {
    it('should return empty array when no prompts registered', () => {
      expect(registry.getAll()).toEqual([])
    })

    it('should return all registered prompts', () => {
      const testPrompt = new TestPrompt()
      const simplePrompt = new SimplePrompt()

      registry.register(testPrompt)
      registry.register(simplePrompt)

      const allPrompts = registry.getAll()
      expect(allPrompts).toHaveLength(2)

      const promptNames = allPrompts.map((p) => p.name)
      expect(promptNames).toContain('test-prompt')
      expect(promptNames).toContain('simple-prompt')
    })

    it('should return stored prompts with correct structure', () => {
      const testPrompt = new TestPrompt()
      registry.register(testPrompt)

      const [storedPrompt] = registry.getAll()
      expect(storedPrompt).toMatchObject({
        name: 'test-prompt',
        description: 'A test prompt for testing purposes',
        arguments: testPrompt.arguments,
        argsSchema: expect.any(Object),
        handler: expect.any(Function),
      })
    })
  })

  describe('get', () => {
    beforeEach(() => {
      registry.register(new TestPrompt())
      registry.register(mockPrompt)
    })

    it('should return prompt when it exists', () => {
      const prompt = registry.get('test-prompt')
      expect(prompt).toBeDefined()
      expect(prompt!.name).toBe('test-prompt')
      expect(prompt!.description).toBe('A test prompt for testing purposes')
    })

    it('should return undefined when prompt does not exist', () => {
      const prompt = registry.get('non-existent')
      expect(prompt).toBeUndefined()
    })

    it('should return working handler function', async () => {
      const prompt = registry.get('test-prompt')
      expect(prompt).toBeDefined()

      const result = await prompt!.handler({ message: 'test', count: 2 })
      expect(result).toEqual({
        description: 'Processed message 2 time(s)',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: 'test test',
            },
          },
        ],
      })
    })

    it('should return working schema validation', () => {
      const prompt = registry.get('mock-prompt')
      expect(prompt).toBeDefined()

      const validResult = prompt!.argsSchema.parse({ value: 42 })
      expect(validResult).toEqual({ value: 42 })

      expect(() => prompt!.argsSchema.parse({ value: 'invalid' })).toThrow()
    })
  })

  describe('has', () => {
    it('should return false for unregistered prompts', () => {
      expect(registry.has('non-existent')).toBe(false)
    })

    it('should return true for registered prompts', () => {
      registry.register(new TestPrompt())
      expect(registry.has('test-prompt')).toBe(true)
    })

    it('should be case sensitive', () => {
      registry.register(new TestPrompt())
      expect(registry.has('Test-Prompt')).toBe(false)
      expect(registry.has('test-prompt')).toBe(true)
    })
  })

  describe('integration tests', () => {
    it('should handle complete workflow', async () => {
      const testPrompt = new TestPrompt()

      // Register
      registry.register(testPrompt)

      // Verify registration
      expect(registry.has('test-prompt')).toBe(true)

      // Get and use
      const retrievedPrompt = registry.get('test-prompt')
      expect(retrievedPrompt).toBeDefined()

      // Validate args
      const args = { message: 'integration test', count: 2 }
      const validatedArgs = retrievedPrompt!.argsSchema.parse(args)
      expect(validatedArgs).toEqual(args)

      // Execute handler
      const result = await retrievedPrompt!.handler(validatedArgs)
      expect(result.description).toBe('Processed message 2 time(s)')
      expect(result.messages[0].content.text).toBe(
        'integration test integration test',
      )
    })

    it('should maintain type safety through registry operations', () => {
      const testPrompt = new TestPrompt()
      registry.register(testPrompt)

      const allPrompts = registry.getAll()

      const testArgs = { message: 'test', count: 2 }
      const originalResult = testPrompt.argsSchema.parse(testArgs)
      const storedResult = allPrompts[0].argsSchema.parse(testArgs)
      expect(storedResult).toEqual(originalResult)
      expect(typeof allPrompts[0].handler).toBe('function')
    })
  })
})
