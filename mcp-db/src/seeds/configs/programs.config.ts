import { Client } from 'pg'
import { SeedConfig } from '../../schema/seed-config.schema.js'
import { transformProgramData } from '../../schema/program.schema.js'

export const ProgramsConfig: SeedConfig = {
  file: 'components-programs.csv',
  table: 'programs',
  conflictColumn: 'acronym',
  beforeSeed: (_client: Client, rawData: unknown[]): void => {
    const { programs } = transformProgramData(rawData)

    rawData.length = 0
    rawData.push(...programs)
  },
}
