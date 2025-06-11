import { describe, it, expect } from 'vitest';
import { FetchDatasetGeographyTool } from '../../../tools/fetch-dataset-geography.tool';

describe('FetchDatasetGeographyTool - Integration Tests', () => {

  it('should fetch real ACS metadata', async () => {
    const tool = new FetchDatasetGeographyTool();
    const datasetName = 'acs/acs1';
    
    const response = await tool.handler({
      dataset: datasetName,
      year: 2022
    });

    expect(response.content[0].type).toBe('text');
    const responseText = response.content[0].text;

	  expect(responseText).toContain('"vintage": "2022-01-01"'); // or whatever properties your geography objects have
	  expect(responseText).toContain('"displayName": "United States"'); // adjust to match your actual structure
	  expect(responseText).toContain('"querySyntax": "us"'); // adjust to match your actual structure
	  expect(responseText).toContain('"queryExample": "for=us:*"');
  }, 10000); // Longer timeout for real API calls

  it('should handle real API errors gracefully', async () => {
    const tool = new FetchDatasetGeographyTool();
    
    const response = await tool.handler({
      dataset: 'nonexistent/dataset'
    });

    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('Geography endpoint returned: 404');
  }, 10000);

  it('should work with timeseries datasets', async () => {
    const tool = new FetchDatasetGeographyTool();
    const datasetName = 'timeseries/healthins/sahie';
    
    const response = await tool.handler({
      dataset: datasetName
    });

    expect(response.content[0].type).toBe('text');
  });
});