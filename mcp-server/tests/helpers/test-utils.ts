import { expect } from 'vitest'

// Helper to create mock fetch responses
export function createMockResponse(
  data: object,
  status = 200,
  statusText = 'OK',
) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      statusText,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

// Helper to create mock fetch error
export function createMockFetchError(message: string) {
  return Promise.reject(new Error(message))
}

// Helper to validate tool structure
export function validateToolStructure(tool: object) {
  expect(tool).toHaveProperty('name')
  expect(tool).toHaveProperty('description')
  expect(tool).toHaveProperty('inputSchema')
  expect(tool).toHaveProperty('argsSchema')
  expect(tool).toHaveProperty('handler')

  expect(typeof tool.name).toBe('string')
  expect(typeof tool.description).toBe('string')
  expect(typeof tool.inputSchema).toBe('object')
  expect(typeof tool.handler).toBe('function')
}

// Helper to validate response structure
export function validateResponseStructure(response: object) {
  expect(response).toHaveProperty('content')
  expect(Array.isArray(response.content)).toBe(true)
  expect(response.content.length).toBeGreaterThan(0)
  expect(response.content[0]).toHaveProperty('type', 'text')
  expect(response.content[0]).toHaveProperty('text')
  expect(typeof response.content[0].text).toBe('string')
}

export function validateJsonResponseStructure(response: object) {
  expect(response).toHaveProperty('content')
  expect(Array.isArray(response.content)).toBe(true)
  expect(response.content.length).toBeGreaterThan(0)
  expect(response.content[0]).toHaveProperty('type', 'json')
  expect(response.content[0]).toHaveProperty('json')
  expect(typeof response.content[0].json).toBe('object')
}

// Sample Census API error response
export const sampleCensusError = {
  error: {
    code: 400,
    message: 'Invalid dataset or year',
  },
}
