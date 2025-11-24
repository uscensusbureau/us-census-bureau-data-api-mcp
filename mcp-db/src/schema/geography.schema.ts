import { z } from 'zod'

// Column mappings from Census API fields to database columns
export const GeographyMappings: Record<string, keyof GeographyRecord> = {
  NAME: 'name',
  GEO_ID: 'ucgid_code',
  SUMLEVEL: 'summary_level_code',
  STATE: 'state_code',
  COUNTY: 'county_code',
  COUSUB: 'county_subdivision_code',
  PLACE: 'place_code',
  ZCTA: 'zip_code_tabulation_area',
  region: 'region_code',
  division: 'division_code',
  INTPTLAT: 'latitude',
  INTPTLON: 'longitude',
} as const

// Field validators for Census API data
export const GeographyValueValidators = {
  NAME: z.string().min(1, 'Name is required'),
  GEO_ID: z.string().min(1, 'UCGID code is required').max(100),
  SUMLEVEL: z
    .string()
    .regex(/^\d{3}$/, 'Summary level must be exactly 3 digits'),
  region: z.string().regex(/^\d{1}$/, 'Region code must be 1 digit'),
  division: z.string().regex(/^\d{1}$/, 'Division code must be 1 digit'),
  STATE: z.string().regex(/^\d{2}$/, 'State code must be 2 digits'),
  COUNTY: z.string().regex(/^\d{3}$/, 'County code must be 3 digits'),
  COUSUB: z.string().regex(/^\d{5}$/, 'County code must be 5 digits'),
  PLACE: z.string().regex(/^\d{5}$/, 'Place code must be 5 digits'),
  ZCTA: z
    .string()
    .regex(/^\d{5}$/, 'Zip code tabulation area must be 5 digits'),
  INTPTLAT: z.number().min(-90).max(90, 'Invalid latitude'),
  INTPTLON: z.number().min(-180).max(180, 'Invalid longitude'),
} as const

// Create type for valid header keys
type GeographyMappingKey = keyof typeof GeographyMappings
type GeographyValidatorKey = keyof typeof GeographyValueValidators

// Geography type definitions with required fields
export const SummaryLevels = {
  nation: {
    summaryLevel: '010',
    requiredFields: ['NAME', 'SUMLEVEL', 'GEO_ID'],
  },
  region: {
    summaryLevel: '020',
    requiredFields: ['NAME', 'SUMLEVEL', 'GEO_ID'],
  },
  division: {
    summaryLevel: '030',
    requiredFields: ['NAME', 'SUMLEVEL', 'GEO_ID'],
  },
  state: {
    summaryLevel: '040',
    requiredFields: [
      'NAME',
      'SUMLEVEL',
      'STATE',
      'GEO_ID',
      'INTPTLAT',
      'INTPTLON',
    ],
  },
  county: {
    summaryLevel: '050',
    requiredFields: [
      'NAME',
      'SUMLEVEL',
      'STATE',
      'COUNTY',
      'GEO_ID',
      'INTPTLAT',
      'INTPTLON',
    ],
  },
  county_subdivision: {
    summaryLevel: '060',
    requiredFields: [
      'NAME',
      'SUMLEVEL',
      'STATE',
      'COUNTY',
      'COUSUB',
      'GEO_ID',
      'INTPTLAT',
      'INTPTLON',
    ],
  },
  place: {
    summaryLevel: '160',
    requiredFields: [
      'NAME',
      'SUMLEVEL',
      'STATE',
      'PLACE',
      'GEO_ID',
      'INTPTLAT',
      'INTPTLON',
    ],
  },
  zip_code_tabulation_area: {
    summaryLevel: '860',
    requiredFields: [
      'NAME',
      'SUMLEVEL',
      'GEO_ID',
      'INTPTLAT',
      'INTPTLON',
      'ZCTA',
    ],
  },
} as const

export const GeographyRecordSchema = z.object({
  name: z.string(),
  for_param: z.string(),
  summary_level_code: z.string().optional(),
  ucgid_code: z.string().max(100).optional(),
  in_param: z.string().nullable(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  region_code: z.string().optional().nullable(),
  division_code: z.string().optional().nullable(),
  state_code: z.string().optional().nullable(),
  county_code: z.string().optional(),
  county_subdivision_code: z.string().optional(),
  place_code: z.string().optional(),
  zip_code_tabulation_area: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type GeographyRecord = z.infer<typeof GeographyRecordSchema>

export const ParentGeographiesSchema = z.object({
  nation: z.array(GeographyRecordSchema).optional(),
  regions: z.array(GeographyRecordSchema).optional(),
  divisions: z.array(GeographyRecordSchema).optional(),
  states: z.array(GeographyRecordSchema).optional(),
  counties: z.array(GeographyRecordSchema).optional(),
  places: z.array(GeographyRecordSchema).optional(),
})

export type ParentGeographies = z.infer<typeof ParentGeographiesSchema>

// Main transformation function for Census API data
export function transformApiGeographyData(
  rawData: unknown[],
  summaryLevel: keyof typeof SummaryLevels,
): GeographyRecord[] {
  console.log(`Transforming ${summaryLevel} data from Census API...`)

  // Validate raw API response format
  const validatedApiResponse = z.array(z.array(z.string())).parse(rawData)

  if (validatedApiResponse.length < 2) {
    throw new Error(
      'Census API response must have at least header row and one data row',
    )
  }

  const headers = validatedApiResponse[0]
  const dataRows = validatedApiResponse.slice(1)

  console.log(
    `Processing ${dataRows.length} records with headers: ${headers.join(', ')}`,
  )

  // Validate that required fields are present
  const expectedHeaders = SummaryLevels[summaryLevel].requiredFields
  const missingHeaders = expectedHeaders.filter(
    (field) => !headers.includes(field),
  )
  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required headers for ${summaryLevel}: ${missingHeaders.join(', ')}`,
    )
  }

  // Transform each row
  const transformedData = dataRows.map((row, index) => {
    if (row.length !== headers.length) {
      throw new Error(
        `Row ${index + 1} has ${row.length} values but expected ${headers.length}`,
      )
    }

    const record: Record<string, string | number | null> = {
      name: '',
      for_param: '',
      in_param: null,
    }

    // Map standard fields by header name (order-independent)
    headers.forEach((header, columnIndex) => {
      // Type-safe check for mapped headers
      const dbColumn = GeographyMappings[header]

      if (!dbColumn) {
        // Skip unmapped headers (like 'us', 'state', etc. from geography filters)
        return
      }

      let value: unknown = row[columnIndex]

      // Type conversion
      if (['INTPTLAT', 'INTPTLON'].includes(header)) {
        value = parseFloat(value as string)
        if (isNaN(value as number)) {
          throw new Error(
            `Row ${index + 1}: Invalid number for ${header}: "${row[columnIndex]}"`,
          )
        }

        record[dbColumn] = parseFloat(value as string)
      } else {
        record[dbColumn] = value as string
      }
    })

    // Add standard timestamps
    record.created_at = new Date().toISOString()
    record.updated_at = new Date().toISOString()

    return record as GeographyRecord
  })

  // Create and validate against dynamic schema
  const schema = createDynamicGeographySchema(headers, summaryLevel)

  try {
    const validatedData = schema.parse(transformedData)
    console.log(
      `✓ Successfully validated ${validatedData.length} ${summaryLevel} records`,
    )
    return validatedData as GeographyRecord[]
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`${summaryLevel} validation failed:`)
      error.issues.slice(0, 5).forEach((issue, i) => {
        const recordIndex = String(issue.path[0])
        const field = issue.path.slice(1).join('.')
        console.error(
          `${i + 1}. Record ${recordIndex}, field "${field}": ${issue.message}`,
        )
      })
      if (error.issues.length > 5) {
        console.error(
          `... and ${error.issues.length - 5} more validation errors`,
        )
      }
    }
    throw new Error(`${summaryLevel} validation failed: ${error}`)
  }
}

// Type guard functions
function isGeographyMappingKey(header: string): header is GeographyMappingKey {
  return header in GeographyMappings
}

function isGeographyValidatorKey(
  header: string,
): header is GeographyValidatorKey {
  return header in GeographyValueValidators
}

// Create dynamic schema based on available headers and geography type
function createDynamicGeographySchema(
  headers: string[],
  summaryLevel: keyof typeof SummaryLevels,
) {
  const geoConfig = SummaryLevels[summaryLevel]

  // Build schema fields based on what's actually in the data
  const schemaFields: Record<string, z.ZodType> = {
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    // Note: for_param and in_param are added by configs after transformation
  }

  // Add validation for each header that has a mapping
  headers.forEach((header) => {
    // Use type guards for safe access
    const validator = isGeographyValidatorKey(header)
      ? GeographyValueValidators[header]
      : undefined
    const dbColumn = isGeographyMappingKey(header)
      ? GeographyMappings[header]
      : undefined

    if (validator && dbColumn) {
      schemaFields[dbColumn] = validator
    }
  })

  // Add geography-specific validations
  if (geoConfig.summaryLevel) {
    schemaFields.summary_level_code = z.literal(geoConfig.summaryLevel)
  }

  return z.array(z.object(schemaFields))
}
