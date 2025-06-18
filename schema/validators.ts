import { z } from "zod";
import type { RefinementCtx } from "zod";

type Dataset = {
	tool: string;
	message: string;
	identifier?: string;
}

type TableArgs = {
	group?: string;
	variables?: string[];
	for?: string;
	ucgid?: string;
}

const datasets: Dataset[] = [
	 {
		tool: "fetch-summary-table",
		message: "Incompatible dataset. Please use the fetch-summary-table tool."
	 },
	 {
		tool: "fetch-timeseries-data",
		message: "Incompatible dataset.",
		identifier: "timeseries"
	 },
	 {
		tool: "fetch-pums-microdata",
		message: "Incompatible dataset.",
		identifier: "pums"
	 },
	 {
		tool: "fetch-subject-table",
		message: "Incompatible dataset.",
		identifier: "subject"
	 }
];

export function datasetValidator(url: string): Dataset {

	const matched = datasets.find((dataset: Dataset) =>
		dataset.identifier ? url.includes(dataset.identifier) : false
	);

	return matched ?? datasets.find((dataset: Dataset) => !("identifier" in dataset))!;
}

export function validateGeographyArgs(args: TableArgs, ctx: RefinementCtx) {
	
	if( !args.for && !args.ucgid ) {
		ctx.addIssue({
      path: ["for", "ucgid"],
      code: z.ZodIssueCode.custom,
      message: 'No geography specified error - define for or ucgid arguments.'
    });
	} else if ( args.for && args.ucgid) {
		ctx.addIssue({
      path: ["for", "ucgid"],
      code: z.ZodIssueCode.custom,
      message: 'Too many geographies specified error - define for or ucgid only, not both.'
    });
	}
}