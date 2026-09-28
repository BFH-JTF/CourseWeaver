/**
 * Central Excel parser: converts a spreadsheet file (xlsx/xls/csv) into the
 * same ParsedCsv structure used by the CSV import pipeline, so all imports
 * (CSV and Excel) share one mapping + save path (CsvImportDialog -> useCsvImport).
 */
import * as XLSX from 'xlsx'
import type { ParsedCsv } from '@/utils/csvParser'
import { parseCsv } from '@/utils/csvParser'

export const EXCEL_EXTENSIONS = ['.xlsx', '.xls', '.xlsm'] as const

export function isExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return EXCEL_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/** Sheet selection: sheet name, 1-based index, or callback on sheet names. */
export type SheetSelector = string | number | ((sheets: string[]) => string)

export interface ExcelParseResult extends ParsedCsv {
  sheetNames: string[]
  selectedSheet: string
}

export function listSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames
}

/**
 * Parse raw spreadsheet content (e.g. from FileReader.readAsArrayBuffer) into
 * ParsedCsv from the selected sheet. Defaults to the first sheet.
 */
export function parseExcel(data: ArrayBuffer | Uint8Array, selector?: SheetSelector): ExcelParseResult {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetNames = workbook.SheetNames

  let selected = sheetNames[0] ?? ''
  if (typeof selector === 'string' && sheetNames.includes(selector)) {
    selected = selector
  } else if (typeof selector === 'number') {
    selected = sheetNames[selector] ?? selected
  } else if (typeof selector === 'function') {
    const byName = selector(sheetNames)
    if (byName && sheetNames.includes(byName)) selected = byName
  }

  const sheet = workbook.Sheets[selected]
  if (!sheet) {
    return { headers: [], rows: [], rawRows: [], sheetNames, selectedSheet: selected }
  }

  // Read as array-of-arrays so we control header handling like parseCsv does.
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  })

  // Remove fully empty rows, mirroring CSV parser behaviour (skips lines without content).
  const filledRows = rawRows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
  if (filledRows.length === 0) {
    return { headers: [], rows: [], rawRows: [], sheetNames, selectedSheet: selected }
  }

  // Serialize back to CSV text and reuse the shared CSV parser -> identical
  // trimming, header handling and row objects for CSV and Excel imports.
  const csvText = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(filledRows))

  return {
    ...parseCsv(csvText, { hasHeader: true, delimiter: ',' }),
    sheetNames,
    selectedSheet: selected,
  }
}

/**
 * Flatten a "Detailed Module Concept" workbook (one sheet per module, fixed
 * layout) into flat rows with headers [module_name, program, module_code, ects,
 * lc_number, lc_content]; learning-cycle rows only. The result flows through
 * the same map/transform/save pipeline as any CSV import.
 */
/**
 * Semester-Inferenz aus dem Dateinamen, z.B. "DBA_Module_Concept_Semester2_FS2027.xlsx" → 2.
 * (Kap. 12.2/13 — nur Vorschlag, die Person bestätigt den Wert im Import-Dialog.)
 */
export function inferSemesterFromFilename(fileName: string): number | null {
  const m = fileName.match(/Semester\s*(\d+)/i)
  const n = m?.[1] ? Number(m[1]) : null
  return n && n >= 1 && n <= 12 ? n : null
}

/**
 * Flatten a "Detailed Module Concept" workbook (one sheet per module, fixed
 * layout) into flat rows with headers [module_name, program, module_code, ects,
 * lc_number, lc_content]; learning-cycle rows only. The result flows through
 * the same map/transform/save pipeline as any CSV import.
 *
 * Zusätzlich (Kap. 13): optionale meta信息 studyProgramId/semester/sourceFile,
 * welche die erzeugten CurriculumModule direkt gesetzt bekommen.
 */
export function parseModuleConceptWorkbook(
  data: ArrayBuffer | Uint8Array,
  opts: { studyProgramId?: string; semester?: number; sourceFile?: string } = {},
): ExcelParseResult & { modules: import('@/types/curriculumMapping').CurriculumModule[] } {
  const workbook = XLSX.read(data, { type: 'array' })

  const headers = ['module_name', 'program', 'module_code', 'ects', 'lc_number', 'lc_content']
  const rows: Record<string, string>[] = []
  const modules: import('@/types/curriculumMapping').CurriculumModule[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const aoa: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '', raw: false })
    if (aoa.length < 5) continue

    // Row 1: "Detailed Module Concept - <Program>"
    const row01 = String(Array.isArray(aoa[0]) ? aoa[0][0] ?? '' : '')
    const titleRow = String(Array.isArray(aoa[1]) ? aoa[1][0] ?? '' : '')
    const programMatch = row01.match(/-\s*(.+)$/)

    // Row 2: "<CODE> - <Module Name>  (<ECTS> ECTS)"
    const moduleMatch = titleRow.match(/^\s*([A-Z]{2,}\d*)\s*-\s*(.+?)\s*\((\d+)\s*ECTS\)/)

    const program = programMatch ? (programMatch[1] ?? sheetName).trim() : sheetName
    // Only structured module sheets ("<CODE> - <Module Name>  (<ECTS> ECTS)") are extracted.
    // Overview sheets like "Module Coordination" (cross-module matrix) are skipped.
    if (!moduleMatch) continue
    const moduleCode = moduleMatch[1] as string
    const moduleName = (moduleMatch[2] as string).trim()
    const ects = moduleMatch[3] as string
    const moduleId = `mod-${program.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

    const cycles: import('@/types/curriculumMapping').LearningCycle[] = []
    // Kap. 1/5: level wird NICHT automatisch definitiv gesetzt (Kap. 5.2: manuell oder LLM-Vorschlag) —
    // für immediate nutzbare Demo leiten wir I (LC1) / M (letzte LC) / R ab; Label übersteuerbar.
    for (const row of aoa.slice(4)) {
      const structural = String(row[0] ?? '')
      const lcMatch = structural.match(/Learning Cycle\s*(\d+)/i)
      if (!lcMatch || !lcMatch[1]) continue
      const lcNumber = Number(lcMatch[1])
      // content = Learning Goals + Main Content, DIDAKTIK/Kap.-12.2: Didaktik & Tools,
      // Assessment-Felder (Description Assignment, Type, Grading %) werden mit übernommen.
      const goals = String(row[2] ?? '').trim()
      const mainContent = String(row[3] ?? '').trim()
      const didactics = String(row[4] ?? '').trim()
      const assignment = String(row[5] ?? '').trim()
      const assignmentTypeRaw = String(row[6] ?? '').trim()
      const gradingRaw = String(row[7] ?? '').trim()
      const content = [goals, mainContent].filter(Boolean).join('\n\n')
      rows.push({
        module_name: moduleName,
        program,
        module_code: moduleCode,
        ects,
        lc_number: String(lcNumber),
        lc_content: content,
      })
      cycles.push({
        id: `${moduleId}-lc${lcNumber}`,
        moduleId,
        number: lcNumber as import('@/types/curriculumMapping').LearningCycle['number'],
        title: `Learning Cycle ${lcNumber}`,
        // Kap Spec ( curriculum-overview): KW-Range aus Struktur-Zeile ("CW 39-40 Learning Cycle 1")
        calendarWeek: (structural.match(/CW\s*([0-9]+(?:\s*[-–/]\s*[0-9]+)?)/i)?.[1] ? `KW ${String(structural.match(/CW\s*([0-9]+(?:\s*[-–/]\s*[0-9]+)?)/i)![1])}` : ''),
        content: [goals, mainContent].filter(Boolean).join('\n\n'),

        structuralElement: `Learning Cycle ${lcNumber}`,
        learningGoals: goals,
        mainContent: mainContent,
        didactics: didactics,
        level: undefined,
        assignmentDescription: assignment || undefined,
        assignmentType: assignmentTypeRaw === 'Graded' ? 'Graded' : assignmentTypeRaw === 'Pass/Fail' ? 'Pass/Fail' : 'Non-graded',
        gradingPercentage: Number(gradingRaw) || undefined,
        sourceFile: opts.sourceFile ?? '',
        sourceRow: lcNumber,
        version: 'v1',
      })
    }

    // согласование Demo-IR-M: erste = I, letzte = M, rest R — ist editable/LLM-suggest
    const maxN = Math.max(0, ...cycles.map(c => (c.number ?? 0) as number))
    for (const c of cycles) {
      const n = Number(c.number ?? 1)
      c.level = n === 1 ? 'I' : n === maxN ? 'M' : 'R'
    }
    if (cycles.length) {
      modules.push({
        id: moduleId,
        name: moduleName,
        // Kap. 12.4/13: FK statt Freitext; human-lesbarer Name bleibt als derived 'program' für Anzeige
        studyProgramId: opts.studyProgramId ?? '',
        semester: opts.semester ?? 0,
        program,
        learningCycles: cycles.sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
      })
    }
  }

  return { headers, rows, rawRows: rows.map(r => headers.map(h => r[h] ?? '')), sheetNames: workbook.SheetNames, selectedSheet: workbook.SheetNames[0] ?? '', modules }
}
