type Dataset = {
	tool: string;
	message: string;
	identifier?: string;
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
