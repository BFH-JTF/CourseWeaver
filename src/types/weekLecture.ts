import type { AclInfo } from '@/types/curriculum'
import type { Weekday } from '@/types/room'

export interface WeekLecture extends AclInfo {
  id?: string
  _id?: string
  moduleIds: string[]
  roomId: string
  weekday: Weekday
  startTime: string
  endTime: string
}

export type WeekLectureExport = WeekLecture[]