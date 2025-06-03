import { describe, it, expect } from 'vitest';
import { datasetValidator } from '../../schema/validators';

describe('datasetValidator', () => {
	it('returns the correct tool name', () => {
		const datasets = ["acs/acs1", "timeseries/data/example", "acs/acs1/pums", "acs/acs1/subject", "unknown/data"]

		expect(datasetValidator(datasets[0]).tool).toBe("fetch-summary-table");
		expect(datasetValidator(datasets[1]).tool).toBe("fetch-timeseries-data");
		expect(datasetValidator(datasets[2]).tool).toBe("fetch-pums-microdata");
		expect(datasetValidator(datasets[3]).tool).toBe("fetch-subject-table");
		expect(datasetValidator(datasets[4]).tool).toBe("fetch-summary-table");
	});
});