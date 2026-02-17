export interface DataTableDatasetEntry {
  dataset_id: string
  dataset_param: string
  year: number | null
  label?: string
}

export interface DataTableSearchResultRow {
  data_table_id: string
  label: string
  datasets: DataTableDatasetEntry[]
}
