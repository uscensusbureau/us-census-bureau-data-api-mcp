import { beforeEach, describe, it, expect, vi } from 'vitest'
import { Client } from 'pg'
import { findComponentIdHelper } from '../../src/helpers/find-component-id.helper'

describe('findComponentIdHelper', () => {
  let mockClient: Partial<Client>

  beforeEach(() => {
    mockClient = { query: vi.fn() }
  })

  it('should return the component id when a match is found', async () => {
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

  it('should return null and warn when no match is found', async () => {
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
      'No component found for dataset_param: unknown/path',
    )

    consoleWarnSpy.mockRestore()
  })
})
