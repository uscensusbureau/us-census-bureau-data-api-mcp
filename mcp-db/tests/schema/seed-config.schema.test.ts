import { describe, expect, it } from 'vitest';
import { SeedConfigSchema } from '../../src/schema/seed-config.schema';

describe('SeedConfig', () => {
	it('should succeed when validated', async () => {
		const seedConfig = {
	    url: 'https://www.census.gov',
	    table: 'geography_levels',
	    dataPath: 'geography_levels',
	    conflictColumn: 'id'
	  };

	  const result = SeedConfigSchema.safeParse(seedConfig);
	  
	  expect(result.success).toBe(true);
	});

	it('should throw error when conflictColumn is missing', async () => {
	  const seedConfig = {
	    file: 'geography_levels_no_conflict.json',
	    table: 'geography_levels',
	    dataPath: 'geography_levels'
	    // conflictColumn is missing
	  };

	  const result = SeedConfigSchema.safeParse(seedConfig);
	  
	  expect(result.success).toBe(false);
	  
	  if (!result.success) {
	    const conflictColumnError = result.error.issues.find(
	      issue => issue.path.includes('conflictColumn')
	    );

	    console.log(conflictColumnError);
	    
	    expect(conflictColumnError).toEqual(
	      expect.objectContaining({
	        code: 'invalid_type',
	        path: ['conflictColumn'],
	        message: 'Invalid input: expected string, received undefined',
	        expected: 'string'
	      })
	    );
	  }
	});
});