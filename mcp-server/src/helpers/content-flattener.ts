/**
 * Content flattening utilities for improved token management.
 *
 * LLM context windows have limited token capacity. These utilities
 * reduce token usage by:
 * - Minifying JSON output (removing unnecessary whitespace)
 * - Stripping fields that don't add value for LLM reasoning
 * - Truncating large result sets with a summary
 *
 * @see https://github.com/uscensusbureau/us-census-bureau-data-api-mcp/issues/70
 */

/**
 * Fields commonly returned by the Census API or database that are not
 * useful for LLM reasoning and can be safely stripped to save tokens.
 */
const DEFAULT_STRIP_FIELDS = new Set([
  'created_at',
  'updated_at',
  'parent_geography_level_id',
])

/**
 * Serialize data to compact JSON, optionally stripping unnecessary fields.
 *
 * Unlike JSON.stringify(data, null, 2), this produces minimal output
 * with no extra whitespace, and filters out fields that waste tokens.
 */
export function flattenJson(
  data: unknown,
  options?: {
    stripFields?: Set<string>
    maxItems?: number
  }
): string {
  const stripFields = options?.stripFields ?? DEFAULT_STRIP_FIELDS
  const maxItems = options?.maxItems

  const processed = stripUnusedFields(data, stripFields)
  const truncated = truncateArray(processed, maxItems)

  return JSON.stringify(truncated)
}

/**
 * Build a compact text response with optional result count summary.
 * Replaces the pattern: `"Found N results:\n\n" + JSON.stringify(data, null, 2)`
 */
export function flattenResponse(
  prefix: string,
  data: unknown,
  options?: {
    stripFields?: Set<string>
    maxItems?: number
  }
): string {
  const maxItems = options?.maxItems
  const json = flattenJson(data, options)
  const itemCount = Array.isArray(data) ? data.length : undefined

  let result = prefix

  if (maxItems && itemCount && itemCount > maxItems) {
    result += ` (showing ${maxItems} of ${itemCount})`
  }

  result += '\n' + json

  return result
}

function stripUnusedFields(data: unknown, fields: Set<string>): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripUnusedFields(item, fields))
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (!fields.has(key) && value !== null) {
        result[key] = stripUnusedFields(value, fields)
      }
    }

    return result
  }

  return data
}

function truncateArray(data: unknown, maxItems?: number): unknown {
  if (!maxItems || !Array.isArray(data)) {
    return data
  }

  if (data.length <= maxItems) {
    return data
  }

  return data.slice(0, maxItems)
}
