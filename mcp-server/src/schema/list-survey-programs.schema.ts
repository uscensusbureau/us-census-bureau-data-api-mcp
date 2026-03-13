import { z } from 'zod'

export const ListSurveyProgramsInputSchema = z.object({})
export type ListSurveyProgramsArgs = z.infer<typeof ListSurveyProgramsInputSchema>