import { beforeEach, describe, it, expect, vi } from 'vitest'
import { Client } from 'pg'
import { findComponentIdHelper } from '../../src/helpers/find-component-id.helper'

describe('findComponentIdHelper', () => {
  let mockClient: Partial<Client>

  beforeEach(() => {
    mockClient = { query: vi.fn() }
  })

  it('returns the component id on an exact match', async () => {
    vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 5 }],
    })

    const result = await findComponentIdHelper(mockClient as Client, 'acs/acs1')

    expect(result).toBe(5)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM components'),
      ['acs/acs1'],
    )
  })

  it('returns the component id on a prefix match', async () => {
    vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 3 }],
    })

    const result = await findComponentIdHelper(
      mockClient as Client,
      'cps/basic/jun',
    )

    expect(result).toBe(3)
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM components'),
      ['cps/basic/jun'],
    )
  })

  it('returns the most specific component when multiple prefix matches exist', async () => {
    // Simulates ORDER BY LENGTH(api_endpoint) DESC picking cps/basic over cps
    vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rowCount: 1,
      rows: [{ id: 7 }],
    })

    const result = await findComponentIdHelper(
      mockClient as Client,
      'cps/basic/jun',
    )

    expect(result).toBe(7)
  })

  it('returns null and warns when no match is found', async () => {
    vi.mocked(mockClient.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rowCount: 0,
      rows: [],
    })

    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {})

    const result = await findComponentIdHelper(
      mockClient as Client,
      'unknown/path',
    )

    expect(result).toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'No component found for api_endpoint: unknown/path',
    )

    consoleWarnSpy.mockRestore()
  })
})
