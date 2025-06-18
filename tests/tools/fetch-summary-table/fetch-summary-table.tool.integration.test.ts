import { describe, it, expect } from 'vitest';
import { FetchSummaryTableTool } from '../../../tools/fetch-summary-table.tool';

describe('FetchSummaryTableTool - Integration Tests', () => {

  it('should fetch real ACS metadata', async () => {
    const tool = new FetchSummaryTableTool();
    const datasetName = 'acs/acs1';
    const groupName = 'B17015';
    
    const response = await tool.handler({
      dataset: datasetName,
      year: 2022,
      get: {
        group: groupName
      },
      for: 'state:*'
    });

    expect(response.content[0].type).toBe('text');
    const responseText = response.content[0].text;
    expect(responseText).toContain(`${datasetName}`);
    expect(responseText).toContain(`${groupName}`);
  }, 10000); // Longer timeout for real API calls

  it('should handle real API errors gracefully', async () => {
    const tool = new FetchSummaryTableTool();
    
    const response = await tool.handler({
      dataset: 'nonexistent/dataset',
      year: 2022,
      get: {
        group: 'B18014'
      }
    });

    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('Census API error: 404 ');
  }, 10000);
});