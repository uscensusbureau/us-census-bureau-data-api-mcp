import { describe, it, expect, beforeAll } from 'vitest';
import { FetchDatasetVariablesTool } from '../../../tools/fetch-dataset-variables.tool';

interface CensusDataset {
  c_vintage?: number;
  c_dataset: string[];
  c_variablesLink: string;
  c_isAvailable: boolean;
  title: string;
  description: string;
}

interface CensusCatalogResponse {
  dataset: CensusDataset[];
}

describe('FetchDatasetVariablesTool - Integration Tests', () => {

  it('should fetch real ACS metadata', async () => {
    const tool = new FetchDatasetVariablesTool();
    const datasetName = 'acs/acs1';
    
    const response = await tool.handler({
      dataset: datasetName,
      year: 2022
    });

    expect(response.content[0].type).toBe('text');
    const responseText = response.content[0].text;

    expect(responseText).toContain('Total Variables: 36635'); 
    expect(responseText).toContain('Dataset: acs/acs1 (2022)');
  }, 10000);

  it('should handle real API errors gracefully', async () => {
    const tool = new FetchDatasetVariablesTool();
    
    const response = await tool.handler({
      dataset: 'nonexistent/dataset'
    });

    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('Variables endpoint returned: 404');
  }, 10000);

  it('should work with timeseries datasets', async () => {
    const tool = new FetchDatasetVariablesTool();
    const datasetName = 'timeseries/healthins/sahie';
    
    const response = await tool.handler({
      dataset: datasetName
    });

    expect(response.content[0].type).toBe('text');
  });

  // Separate 
  describe('when a random dataset is fetched', () => {
    let randomDatasets: Array<{ dataset: string; year?: number; title: string }> = [];

    beforeAll(async () => {
      try {
        // Fetch the catalog from Census API
        const catalogUrl = 'https://api.census.gov/data.json';
        console.log('Fetching Census API catalog for random dataset tests...');
        
        // Use the exact same pattern as your working tool
        const fetch = (await import("node-fetch")).default;
        const response = await fetch(catalogUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch catalog: ${response.status} ${response.statusText}`);
        }
        
        const catalog: CensusCatalogResponse = await response.json() as CensusCatalogResponse;
        
        // Filter to only available datasets with variables links
        const availableDatasets = catalog.dataset.filter(ds => 
          ds.c_isAvailable && 
          ds.c_variablesLink && 
          ds.c_dataset && 
          ds.c_dataset.length > 0
        );
        
        console.log(`Found ${availableDatasets.length} available datasets`);
        
        if (availableDatasets.length === 0) {
          throw new Error('No available datasets found in catalog');
        }
        
        // Randomly select 10 datasets
        const shuffled = availableDatasets.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 10);
        
        // Convert to our test format
        randomDatasets = selected.map(ds => ({
          dataset: ds.c_dataset.join('/'),
          year: ds.c_vintage,
          title: ds.title
        }));
        
        console.log('Selected random datasets for testing:');
        randomDatasets.forEach((ds, i) => {
          console.log(`${i + 1}. ${ds.dataset}${ds.year ? ` (${ds.year})` : ''} - ${ds.title}`);
        });
        
      } catch (error) {
        console.error('Failed to fetch random datasets from API');
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        throw error; // Re-throw the error since we don't have fallback datasets
      }
      
      // Ensure we have datasets to test
      if (randomDatasets.length === 0) {
        throw new Error('No datasets available for testing - API returned empty dataset list');
      }
    }, 30000);

    it('should successfully fetch variables for all random datasets', async () => {
      // Guard against undefined randomDatasets
      expect(randomDatasets).toBeDefined();
      expect(randomDatasets.length).toBeGreaterThan(0);
      
      const tool = new FetchDatasetVariablesTool();
      const results: Array<{
        dataset: string;
        year?: number;
        title: string;
        success: boolean;
        variableCount?: number;
        error?: string;
      }> = [];

      // Test each randomly selected dataset
      for (const testDataset of randomDatasets) {
        try {
          console.log(`\nTesting: ${testDataset.dataset}${testDataset.year ? ` (${testDataset.year})` : ''}`);
          
          const response = await tool.handler({
            dataset: testDataset.dataset,
            ...(testDataset.year && { year: testDataset.year })
          });

          expect(response.content).toHaveLength(1);
          expect(response.content[0].type).toBe('text');
          
          const responseText = response.content[0].text;
          
          // Extract variable count from response
          const variableCountMatch = responseText.match(/Total Variables: (\d+)/);
          const variableCount = variableCountMatch ? parseInt(variableCountMatch[1]) : 0;
          
          // Verify response contains expected structure
          expect(responseText).toContain(`Dataset: ${testDataset.dataset}`);
          expect(responseText).toContain('Total Variables:');
          expect(responseText).toContain('Complete variable list:');
          
          // Verify it contains valid JSON for variables
          const jsonStartIndex = responseText.indexOf('[');
          const jsonPart = responseText.substring(jsonStartIndex);
          const variables = JSON.parse(jsonPart);
          
          expect(Array.isArray(variables)).toBe(true);
          expect(variables.length).toBe(variableCount);
          
          // FIX: Each variable should be a string, not an object
          variables.forEach((variable: string) => {
            expect(typeof variable).toBe('string');
            expect(variable.length).toBeGreaterThan(0); // Should be non-empty string
          });

          results.push({
            dataset: testDataset.dataset,
            year: testDataset.year,
            title: testDataset.title,
            success: true,
            variableCount
          });

          console.log(`✓ Success: ${variableCount} variables found`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`✗ Failed: ${errorMessage}`);
          
          results.push({
            dataset: testDataset.dataset,
            year: testDataset.year,
            title: testDataset.title,
            success: false,
            error: errorMessage
          });
        }
      }

      // Summary reporting
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`\n=== TEST SUMMARY ===`);
      console.log(`Successful: ${successful.length}/${results.length}`);
      console.log(`Failed: ${failed.length}/${results.length}`);
      
      if (successful.length > 0) {
        console.log(`\nSuccessful datasets:`);
        successful.forEach(result => {
          console.log(`  ✓ ${result.dataset}${result.year ? ` (${result.year})` : ''} - ${result.variableCount} variables`);
        });
      }

      if (failed.length > 0) {
        console.log(`\nFailed datasets:`);
        failed.forEach(result => {
          console.log(`  ✗ ${result.dataset}${result.year ? ` (${result.year})` : ''} - ${result.error}`);
        });
      }

      // Test should pass if at least 70% of datasets work
      const successRate = successful.length / results.length;
      expect(successRate).toBeGreaterThanOrEqual(0.7);
      
    }, 120000);

    it('should handle schema validation correctly across different dataset types', async () => {
      // Guard against undefined randomDatasets
      expect(randomDatasets).toBeDefined();
      expect(randomDatasets.length).toBeGreaterThan(0);
      
      const tool = new FetchDatasetVariablesTool();
      
      // Test a few specific dataset types if they were selected
      const acsDataset = randomDatasets.find(ds => ds.dataset.includes('acs'));
      const cbpDataset = randomDatasets.find(ds => ds.dataset.includes('cbp'));
      const cpsDataset = randomDatasets.find(ds => ds.dataset.includes('cps'));

      const testCases = [
        { dataset: acsDataset, type: 'ACS (American Community Survey)' },
        { dataset: cbpDataset, type: 'CBP (County Business Patterns)' },
        { dataset: cpsDataset, type: 'CPS (Current Population Survey)' }
      ].filter(tc => tc.dataset); // Only test if we have these dataset types

      for (const testCase of testCases) {
        if (!testCase.dataset) continue;
        
        console.log(`\nTesting schema validation for ${testCase.type}: ${testCase.dataset.dataset}`);
        
        const response = await tool.handler({
          dataset: testCase.dataset.dataset,
          ...(testCase.dataset.year && { year: testCase.dataset.year })
        });

        expect(response.content[0].type).toBe('text');
        const responseText = response.content[0].text;
        
        // Should not contain error messages
        expect(responseText).not.toContain('validation failed');
        expect(responseText).not.toContain('Schema validation failed');
        expect(responseText).not.toContain('Response validation failed');
        
        // Should contain valid structure
        expect(responseText).toContain('Dataset:');
        expect(responseText).toContain('Total Variables:');
        
        console.log(`✓ Schema validation passed for ${testCase.type}`);
      }
    }, 60000);

    it('should handle edge cases with random datasets', async () => {  
      expect(randomDatasets).toBeDefined(); // Just in case tests fail
      
      const tool = new FetchDatasetVariablesTool();
      
      // Test with invalid year for a known dataset
      if (randomDatasets.length > 0) {
        const testDataset = randomDatasets[0];
        const futureYearResponse = await tool.handler({
          dataset: testDataset.dataset,
          year: 2030
        });
        
        expect(futureYearResponse.content[0].type).toBe('text');
        // Should either work (if dataset is timeless) or return an error
        const responseText = futureYearResponse.content[0].text;
        console.log(`Future year test result: ${responseText.substring(0, 100)}...`);
      }
    }, 30000);
  });

  it('should handle general edge cases and error conditions', async () => {
    const tool = new FetchDatasetVariablesTool();
    
    // Test with invalid dataset
    const invalidResponse = await tool.handler({
      dataset: 'nonexistent/invalid/dataset'
    });
    
    expect(invalidResponse.content[0].type).toBe('text');
    expect(invalidResponse.content[0].text).toContain('Variables endpoint returned:');
  }, 30000);
});