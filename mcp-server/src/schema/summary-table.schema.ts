import { z } from 'zod'

import {
  baseFields,
  baseProperties,
  geoFields,
  geoProperties,
  getFields,
  getProperties,
  yearField,
  yearProperty,
} from './table.schema.js'

export const TableSchema = {
  type: 'object',
  properties: {
    ...baseProperties,
    ...yearProperty,
    ...getProperties,
    ...geoProperties,
  },
  required: ['dataset', 'year', 'get'],
}

export const FetchTableInputSchema = z.object({
  ...baseFields,
  ...yearField,
  ...getFields,
  ...geoFields,
})

export type TableArgs = z.infer<typeof FetchTableInputSchema>
