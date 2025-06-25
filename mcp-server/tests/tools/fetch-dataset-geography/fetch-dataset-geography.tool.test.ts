const mockFetch = vi.fn();

vi.mock('node-fetch', () => ({
	default: mockFetch
}));

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FetchDatasetGeographyTool } from '../../../src/tools/fetch-dataset-geography.tool';
import { 
  validateResponseStructure,
  validateToolStructure, 
  validateResponseStructure,
  createMockResponse,
  createMockFetchError,
  sampleCensusError
} from '../../helpers/test-utils.js';

import { sampleGeographyResponse } from '../../helpers/test-data.js';

describe('FetchDatasetGeographyTool', () => {
  let tool: FetchDatasetGeographyTool;

  beforeEach(() => {
    tool = new FetchDatasetGeographyTool();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Tool Configuration', () => {
    it('should have correct tool metadata', () => {
      validateToolStructure(tool);
      expect(tool.name).toBe('fetch-dataset-geography');
      expect(tool.description).toBe("Fetch available geographies for filtering a dataset.");
    });

    it('should have valid input schema', () => {
      const schema = tool.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('dataset');
      expect(schema.properties).toHaveProperty('year');
      expect(schema.required).toEqual(['dataset']);
    });

    it('should have matching args schema', () => {
      // Test required fields
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022
      };
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow();
    });
  });

  describe('Schema Validation', () => {
    it('should validate required parameters', () => {
      const incompleteArgs = { year: 2024 }; // missing dataset
      expect(() => tool.argsSchema.parse(incompleteArgs)).toThrow();
    });

    it('should validate parameter types', () => {
      const invalidArgs = {
        dataset: 123, // should be string
        year: '2022', // should be number
      };
      expect(() => tool.argsSchema.parse(invalidArgs)).toThrow();
    });

    it('should accept valid optional parameters', () => {
      const validArgs = {
        dataset: 'acs/acs1',
        year: 2022
      };
      expect(() => tool.argsSchema.parse(validArgs)).not.toThrow();
    });
  });

  describe('API Key Handling', () => {
    it('should return error when API key is missing', async () => {
      const originalApiKey = process.env.CENSUS_API_KEY;
      delete process.env.CENSUS_API_KEY;

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      const response = await tool.handler(args);
      validateResponseStructure(response);
      expect(response.content[0].text).toContain('CENSUS_API_KEY is not set');

      // Restore API key
      process.env.CENSUS_API_KEY = originalApiKey;
    });

    it('should use API key when available', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGeographyResponse));

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      await tool.handler(args);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=')
      );
    });
  });

  describe('URL Construction', () => {
    it('should construct basic URL correctly', async () => {

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      await tool.handler(args);
      const calls = mockFetch.mock.calls;
      expect(calls[0][0]).toContain('https://api.census.gov/data/2022/acs/acs1/geography.json?key=');
    });

    it('should construct URL without year for timeseries', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGeographyResponse));

      const args = {
        dataset: 'timeseries/asm/area2012'
      };

      await tool.handler(args);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.census.gov/data/timeseries/asm/area2012/geography.json?key=')
      );
    });
  });

  describe('API Response Handling', () => {
    it('should handle successful API response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleGeographyResponse));

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      const response = await tool.handler(args);
      validateResponseStructure(response);
      
      // Since you changed to JSON response, check for JSON content
      expect(response.content[0].type).toBe('text');

      const responseText = response.content[0].text;
		  
		  expect(responseText).toContain('code'); // or whatever properties your geography objects have
		  expect(responseText).toContain('name'); // adjust to match your actual structure
		  expect(responseText).toContain('displayName'); // adjust to match your actual structure
 
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue(createMockResponse(sampleCensusError, 400, 'Bad Request'));

      const args = {
        dataset: 'invalid/dataset',
        year: 2022
      };

      const response = await tool.handler(args);
      validateResponseStructure(response);
      expect(response.content[0].text).toContain(
        'Geography endpoint returned: 400 Bad Request'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementation(() => createMockFetchError('Network error'));

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      const response = await tool.handler(args);
      validateResponseStructure(response);
      expect(response.content[0].text).toContain('Failed to fetch dataset geography levels: Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const args = {
        dataset: 'acs/acs1',
        year: 2022
      };

      const response = await tool.handler(args);
      validateResponseStructure(response);
      expect(response.content[0].text).toContain('Failed to fetch dataset geography levels: Invalid JSON');
    });
  });
});