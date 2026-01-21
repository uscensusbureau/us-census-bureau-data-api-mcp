import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { Client } from 'pg'
import { promises as fs } from 'fs'
import { createDatasetTopics } from '../../src/helpers/create-dataset-topics.helper'
import * as parseCsvModule from '../../src/helpers/parse-csv-line.helper.js'

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}))

vi.mock('../../src/helpers/parse-csv-line.helper.js')

describe('createDatasetTopics', () => {
  let mockClient: Client
  let mockQuery: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery = vi.fn()
    mockClient = { query: mockQuery } as unknown as Client
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates dataset-topic relationships in batch', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","Demographics, Income"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'ABSCB2017',
      'Demographics, Income',
    ])

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, dataset_id: 'ABSCB2017' }],
      }) // Fetch all datasets
      .mockResolvedValueOnce({
        rows: [
          { id: 10, topic_string: 'Demographics' },
          { id: 11, topic_string: 'Income' },
        ],
      }) // Fetch all topics
      .mockResolvedValueOnce({ rows: [] }) // Bulk insert

    await createDatasetTopics(mockClient)

    // Should have 3 queries total: fetch datasets, fetch topics, bulk insert
    expect(mockQuery).toHaveBeenCalledTimes(3)

    // Verify bulk insert with both relationships
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dataset_topics'),
      [1, 10, 1, 11],
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (dataset_id, topic_id) DO NOTHING'),
      [1, 10, 1, 11],
    )
  })

  it('skips when dataset not found', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"INVALID","Demographics"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'INVALID',
      'Demographics',
    ])

    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // No datasets found
      .mockResolvedValueOnce({
        rows: [{ id: 10, topic_string: 'Demographics' }],
      }) // Topics found
    // No bulk insert call since no valid relationships

    await createDatasetTopics(mockClient)

    // Should only have 2 queries (fetch datasets, fetch topics), no insert
    expect(mockQuery).toHaveBeenCalledTimes(2)

    const inserts = mockQuery.mock.calls.filter((call) =>
      call[0].includes('INSERT INTO dataset_topics'),
    )
    expect(inserts).toHaveLength(0)
  })

  it('skips when topic not found', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","InvalidTopic"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'ABSCB2017',
      'InvalidTopic',
    ])

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, dataset_id: 'ABSCB2017' }],
      })
      .mockResolvedValueOnce({ rows: [] }) // No topics found

    await createDatasetTopics(mockClient)

    // Should only have 2 queries (fetch datasets, fetch topics), no insert
    expect(mockQuery).toHaveBeenCalledTimes(2)

    const inserts = mockQuery.mock.calls.filter((call) =>
      call[0].includes('INSERT INTO dataset_topics'),
    )
    expect(inserts).toHaveLength(0)
  })

  it('handles conflicts with DO NOTHING', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","Demographics"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'ABSCB2017',
      'Demographics',
    ])

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, dataset_id: 'ABSCB2017' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, topic_string: 'Demographics' }],
      })
      .mockResolvedValueOnce({ rows: [] }) // Bulk insert with conflict handling

    await createDatasetTopics(mockClient)

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (dataset_id, topic_id) DO NOTHING'),
      [1, 10],
    )
  })

  it('skips malformed CSV lines', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
malformed line
"ABSCB2017","Demographics"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine)
      .mockReturnValueOnce(null) // malformed line (skipped)
      .mockReturnValueOnce(['ABSCB2017', 'Demographics']) // valid line

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, dataset_id: 'ABSCB2017' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, topic_string: 'Demographics' }],
      })
      .mockResolvedValueOnce({ rows: [] }) // Bulk insert

    await createDatasetTopics(mockClient)

    // Should process only the valid line
    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dataset_topics'),
      [1, 10],
    )
  })

  it('handles multiple datasets and topics', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","Demographics, Income"
"ECNEXPSVC2012","Business, Geography"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine)
      .mockReturnValueOnce(['ABSCB2017', 'Demographics, Income'])
      .mockReturnValueOnce(['ECNEXPSVC2012', 'Business, Geography'])

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: 1, dataset_id: 'ABSCB2017' },
          { id: 2, dataset_id: 'ECNEXPSVC2012' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 10, topic_string: 'Demographics' },
          { id: 11, topic_string: 'Income' },
          { id: 12, topic_string: 'Business' },
          { id: 13, topic_string: 'Geography' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // Bulk insert all 4 relationships

    await createDatasetTopics(mockClient)

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dataset_topics'),
      [1, 10, 1, 11, 2, 12, 2, 13],
    )
  })

  it('throws on file read error', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

    await expect(createDatasetTopics(mockClient)).rejects.toThrow(
      'File not found',
    )
  })

  it('throws on database error during fetch', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","Demographics"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'ABSCB2017',
      'Demographics',
    ])

    mockQuery.mockRejectedValueOnce(new Error('DB error'))

    await expect(createDatasetTopics(mockClient)).rejects.toThrow('DB error')
  })

  it('throws on database error during insert', async () => {
    const mockCsv = `"DATASET_STRING","TOPIC_STRING"
"ABSCB2017","Demographics"`

    vi.mocked(fs.readFile).mockResolvedValue(mockCsv)
    vi.mocked(parseCsvModule.parseCSVLine).mockReturnValueOnce([
      'ABSCB2017',
      'Demographics',
    ])

    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1, dataset_id: 'ABSCB2017' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10, topic_string: 'Demographics' }],
      })
      .mockRejectedValueOnce(new Error('Insert failed'))

    await expect(createDatasetTopics(mockClient)).rejects.toThrow(
      'Insert failed',
    )
  })
})
