import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { z } from 'zod'
import { BaseTool } from '../../../src/tools/base.tool'
import { ToolContent } from '../../../src/types/base.types'

// Mock the process.env directly
const originalEnv = process.env

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = originalEnv
})

class MockToolWithApiKey extends BaseTool<{ testArg: string }> {
  name = 'mock-tool-with-api'
  description = 'A mock tool that requires API key'
  readonly requiresApiKey = true
  inputSchema = {
    type: 'object',
    properties: {
      testArg: { type: 'string' }
    },
    required: ['testArg']
  }

  get argsSchema() {
    return z.object({
      testArg: z.string()
    })
  }

  protected async toolHandler(args: { testArg: string }, apiKey?: string): Promise<{ content: ToolContent[] }> {
    return this.createSuccessResponse(`Executed with ${args.testArg} and key ${apiKey}`)
  }
}

class MockToolWithoutApiKey extends BaseTool<{ testArg: string }> {
  name = 'mock-tool-without-api'
  description = 'A mock tool that does not require API key'
  readonly requiresApiKey = false
  inputSchema = {
    type: 'object',
    properties: {
      testArg: { type: 'string' }
    },
    required: ['testArg']
  }

  get argsSchema() {
    return z.object({
      testArg: z.string()
    })
  }

  protected async toolHandler(args: { testArg: string }): Promise<{ content: ToolContent[] }> {
    return this.createSuccessResponse(`Executed with ${args.testArg} without API key`)
  }
}

class ErrorThrowingToolWithApiKey extends BaseTool<{ testArg: string }> {
  name = 'error-tool-with-api'
  description = 'A tool that throws errors and requires API key'
  readonly requiresApiKey = true
  inputSchema = {
    type: 'object',
    properties: {
      testArg: { type: 'string' }
    },
    required: ['testArg']
  }

  get argsSchema() {
    return z.object({
      testArg: z.string()
    })
  }

  protected async toolHandler(args: { testArg: string }, apiKey?: string): Promise<{ content: ToolContent[] }> {
    console.log(args, apiKey)
    throw new Error('Test error from toolHandler method')
  }
}

class ErrorThrowingToolWithoutApiKey extends BaseTool<{ testArg: string }> {
  name = 'error-tool-without-api'
  description = 'A tool that throws errors and does not require API key'
  readonly requiresApiKey = false
  inputSchema = {
    type: 'object',
    properties: {
      testArg: { type: 'string' }
    },
    required: ['testArg']
  }

  get argsSchema() {
    return z.object({
      testArg: z.string()
    })
  }

  protected async toolHandler(args: { testArg: string }, apiKey?: string): Promise<{ content: ToolContent[] }> {
    console.log(args, apiKey)
    throw new Error('Test error from toolHandler method')
  }
}

describe('BaseTool', () => {
  describe('handler', () => {
    let mockToolWithApiKey: MockToolWithApiKey
    let mockToolWithoutApiKey: MockToolWithoutApiKey
    let errorToolWithApiKey: ErrorThrowingToolWithApiKey
    let errorToolWithoutApiKey: ErrorThrowingToolWithoutApiKey

    beforeEach(() => {
      mockToolWithApiKey = new MockToolWithApiKey()
      mockToolWithoutApiKey = new MockToolWithoutApiKey()
      errorToolWithApiKey = new ErrorThrowingToolWithApiKey()
      errorToolWithoutApiKey = new ErrorThrowingToolWithoutApiKey()
    })

    describe('API key validation for tools that require it', () => {
      it('should return error response when CENSUS_API_KEY is not set', async () => {
        // Mock process.env to not have the key
        process.env = { ...originalEnv }
        delete process.env.CENSUS_API_KEY

        const result = await mockToolWithApiKey.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error: CENSUS_API_KEY is not set.'
          }]
        })
      })

      it('should return error response when CENSUS_API_KEY is empty string', async () => {
        // Mock process.env with empty string
        process.env = { ...originalEnv, CENSUS_API_KEY: '' }

        const result = await mockToolWithApiKey.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Error: CENSUS_API_KEY is not set.'
          }]
        })
      })

      it('should call toolHandler method when CENSUS_API_KEY is set', async () => {
        // Mock process.env with a valid key
        process.env = { ...originalEnv, CENSUS_API_KEY: 'test-api-key' }
        
        const result = await mockToolWithApiKey.handler({ testArg: 'test-value' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with test-value and key test-api-key'
          }]
        })
      })
    })

    describe('API key handling for tools that do not require it', () => {
      it('should work without API key when requiresApiKey is false', async () => {
        // Mock process.env to not have the key
        process.env = { ...originalEnv }
        delete process.env.CENSUS_API_KEY

        const result = await mockToolWithoutApiKey.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with test without API key'
          }]
        })
      })

      it('should work even when API key is present but not required', async () => {
        // Mock process.env with a valid key (should be ignored)
        process.env = { ...originalEnv, CENSUS_API_KEY: 'ignored-api-key' }
        
        const result = await mockToolWithoutApiKey.handler({ testArg: 'test-value' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with test-value without API key'
          }]
        })
      })
    })

    describe('error handling for tools with API key requirement', () => {
      it('should catch and handle errors from toolHandler method', async () => {
        process.env = { ...originalEnv, CENSUS_API_KEY: 'test-api-key' }

        const result = await errorToolWithApiKey.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Unexpected error: Test error from toolHandler method'
          }]
        })
      })
    })

    describe('error handling for tools without API key requirement', () => {
      it('should catch and handle errors from toolHandler method', async () => {
        // No API key needed
        process.env = { ...originalEnv }
        delete process.env.CENSUS_API_KEY

        const result = await errorToolWithoutApiKey.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Unexpected error: Test error from toolHandler method'
          }]
        })
      })
    })

    describe('error handling edge cases', () => {
      it('should handle errors that do not have a message property', async () => {
        class NonErrorThrowingTool extends BaseTool<{ testArg: string }> {
          name = 'non-error-tool'
          description = 'A tool that throws non-Error objects'
          readonly requiresApiKey = false
          inputSchema = {
            type: 'object',
            properties: {
              testArg: { type: 'string' }
            },
            required: ['testArg']
          }

          get argsSchema() {
            return z.object({
              testArg: z.string()
            })
          }

          protected async toolHandler(args: { testArg: string }, apiKey?: string): Promise<{ content: ToolContent[] }> {
            console.log(args, apiKey)
            throw 'String error'
          }
        }

        const nonErrorTool = new NonErrorThrowingTool()
        const result = await nonErrorTool.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Unexpected error: String error'
          }]
        })
      })

      it('should handle async errors properly', async () => {
        class AsyncErrorTool extends BaseTool<{ testArg: string }> {
          name = 'async-error-tool'
          description = 'A tool that throws async errors'
          readonly requiresApiKey = true
          inputSchema = {
            type: 'object',
            properties: {
              testArg: { type: 'string' }
            },
            required: ['testArg']
          }

          get argsSchema() {
            return z.object({
              testArg: z.string()
            })
          }

          protected async toolHandler(args: { testArg: string }, apiKey?: string): Promise<{ content: ToolContent[] }> {
            console.log(args, apiKey)
            await new Promise(resolve => setTimeout(resolve, 10))
            throw new Error('Async error')
          }
        }

        process.env = { ...originalEnv, CENSUS_API_KEY: 'test-api-key' }
        const asyncErrorTool = new AsyncErrorTool()

        const result = await asyncErrorTool.handler({ testArg: 'test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Unexpected error: Async error'
          }]
        })
      })
    })

    describe('successful execution', () => {
      it('should return success response from toolHandler method with API key', async () => {
        process.env = { ...originalEnv, CENSUS_API_KEY: 'valid-key' }

        const result = await mockToolWithApiKey.handler({ testArg: 'success-test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with success-test and key valid-key'
          }]
        })
      })

      it('should return success response from toolHandler method without API key', async () => {
        // No API key set or needed
        process.env = { ...originalEnv }
        delete process.env.CENSUS_API_KEY

        const result = await mockToolWithoutApiKey.handler({ testArg: 'success-test' })

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with success-test without API key'
          }]
        })
      })

      it('should pass correct arguments to toolHandler method', async () => {
        process.env = { ...originalEnv, CENSUS_API_KEY: 'test-key-123' }
        
        const testArgs = { testArg: 'complex-test-value' }
        const result = await mockToolWithApiKey.handler(testArgs)

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: 'Executed with complex-test-value and key test-key-123'
          }]
        })
      })
    })

    describe('requiresApiKey property behavior', () => {
      it('should correctly identify tools that require API keys', () => {
        expect(mockToolWithApiKey.requiresApiKey).toBe(true)
        expect(errorToolWithApiKey.requiresApiKey).toBe(true)
      })

      it('should correctly identify tools that do not require API keys', () => {
        expect(mockToolWithoutApiKey.requiresApiKey).toBe(false)
        expect(errorToolWithoutApiKey.requiresApiKey).toBe(false)
      })
    })
  })
})