export type SkillLevel = 'Introduction' | 'Regular' | 'Master' | 'I' | 'R' | 'M'

export interface Competency {
  id?: string
  _id?: string
  name: string
  category?: string
  topic?: string
  description?: string
  level?: SkillLevel | string
}

export type CompetencyExport = Competency[]
