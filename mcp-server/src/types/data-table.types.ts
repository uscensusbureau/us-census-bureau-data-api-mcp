export interface DataTableSearchResultRow {
  data_table_id: string
  label: string
  component: string
  datasets: Record<string, string[]>
}
