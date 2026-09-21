import type { AclInfo } from '@/types/curriculum'

export interface SemesterSchedule extends AclInfo {
  id?: string
  _id?: string
  semesterId: string
}

export type SemesterScheduleExport = SemesterSchedule[]