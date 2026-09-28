/**
 * CourseWeaver konsumiert nur das finale JSON aus Schritt F – keine Pipeline in Vue.
 */
import type { CurriculumMappingReport } from '@/types/curriculumMapping'

export async function fetchMappingReport(url: string): Promise<CurriculumMappingReport> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Report nicht ladbar: ${r.status}`)
  return r.json()
}

export function heatmapToMatrix(report: CurriculumMappingReport) {
  return report.moduleHeatmap ?? {}
}
