import { describe, it, expect } from 'vitest';
import { DescribeDatasetTool } from '../../../tools/describe-dataset.tool';

describe('DescribeDatasetTool - Integration Tests', () => {

  it('should fetch real ACS metadata', async () => {
    const tool = new DescribeDatasetTool();
    const datasetName = 'acs/acs1';
    
    const response = await tool.handler({
      dataset: datasetName,
      year: 2022
    });

    expect(response.content[0].type).toBe('text');
    const responseText = response.content[0].text;
    expect(responseText).toContain('"@type": "DatasetMetadata"');
    expect(responseText).toContain('American Community Survey');
    expect(responseText).toContain(`http://api.census.gov/data/2022/${datasetName}`);
    expect(responseText).toContain('dataset endpoint');
  }, 10000); // Longer timeout for real API calls

  it('should handle real API errors gracefully', async () => {
    const tool = new DescribeDatasetTool();
    
    const response = await tool.handler({
      dataset: 'nonexistent/dataset'
    });

    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('Failed to fetch dataset metadata');
  }, 10000);

  it('should work with timeseries datasets', async () => {
    const tool = new DescribeDatasetTool();
    const datasetName = 'timeseries/healthins/sahie';
    
    const response = await tool.handler({
      dataset: datasetName
    });

    expect(response.content[0].type).toBe('text');
    const responseText = response.content[0].text;
    expect(responseText).toContain('"@type": "DatasetMetadata"');
    expect(responseText).toContain(`http://api.census.gov/data/${datasetName}`);
  }, 10000);
});