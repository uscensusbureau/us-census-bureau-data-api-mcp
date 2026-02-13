export interface DataTableDatasetEntry {
  dataset_id: string
  year: number
  label?: string
}

export interface DataTableSearchResultRow {
  data_table_id: string
  label: string
  datasets: DataTableDatasetEntry[]
}
