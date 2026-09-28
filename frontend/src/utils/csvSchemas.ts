import type { ImportType, ImportTypeConfig, ImportFieldDefinition, ColumnMapping } from '@/types/csvImport'
import type { Competency, SkillLevel } from '@/types/competency'
import type { Module } from '@/stores/curriculum'
import type { StudyProgram } from '@/types/curriculum'
import type { ProofOfKnowledge, AssessmentForm, AssignmentScope } from '@/types/proofOfKnowledge'
import type { ProofOfCompetency, AnswerFormat } from '@/types/proofOfCompetency'
import type { Department, Program, Degree } from '@/types/curriculum'
import type { MatrixCompetency } from '@/types/matrixCompetency'
import { parseCsv } from '@/utils/csvParser'
import type { CurriculumModule, LearningCycle } from '@/types/curriculumMapping'

export function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseStringArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map(String).map(s => s.trim()).filter(Boolean)
        }
      } catch {
        // fallback to delimiter split
      }
    }
    return trimmed
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  return [String(val).trim()].filter(Boolean)
}

export function autoMapColumns(headers: string[], fields: ImportFieldDefinition[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedHeaders = new Set<string>()

  // 1. Pass 1: Try exact or alias matches
  for (const field of fields) {
    const fieldNorm = normalizeHeader(field.key)
    const labelNorm = normalizeHeader(field.label)
    const aliasesNorm = field.aliases.map(normalizeHeader)

    let matchedHeader: string | null = null

    // Exact header match first
    for (const h of headers) {
      if (usedHeaders.has(h)) continue
      const hNorm = normalizeHeader(h)
      if (hNorm === fieldNorm || hNorm === labelNorm || aliasesNorm.includes(hNorm)) {
        matchedHeader = h
        break
      }
    }

    if (matchedHeader) {
      mapping[field.key] = matchedHeader
      usedHeaders.add(matchedHeader)
    } else {
      mapping[field.key] = null
    }
  }

  return mapping
}

/** Shared single source of truth for applying a ColumnMapping to parsed rows. */
export function applyColumnMapping(
  rows: Record<string, string>[],
  fields: ImportFieldDefinition[],
  mapping: ColumnMapping
): Record<string, any>[] {
  return rows.map(row => {
    const obj: Record<string, any> = {}
    for (const field of fields) {
      const header = mapping[field.key]
      if (header && row[header] !== undefined) {
        obj[field.key] = row[header]
      } else if (field.defaultValue !== undefined) {
        obj[field.key] = field.defaultValue
      }
    }
    return obj
  })
}

/**
 * Parse pasted/imported CSV text into typed entities through the central
 * import module (auto-mapping + schema transform). Used by composables that
 * accept CSV text so no duplicate parsers exist.
 */
export function parseImportText(type: ImportType, text: string): any[] {
  const config = IMPORT_CONFIGS[type]
  const parsed = parseCsv(text, { hasHeader: true })
  const mapping = autoMapColumns(parsed.headers, config.fields)
  return config.transform(applyColumnMapping(parsed.rows, config.fields, mapping))
}

export const IMPORT_CONFIGS: Record<ImportType, ImportTypeConfig> = {
  competencies: {
    type: 'competencies',
    label: 'Competencies',
    icon: 'mdi-school',
    description: 'Competencies, topics, and taxonomy learning objectives.',
    entityName: 'Competency',
    fields: [
      {
        key: 'name',
        label: 'Competency / Topic Name',
        required: true,
        type: 'string',
        description: 'Name of the competency or topic',
        aliases: ['name', 'topic', 'competency', 'title', 'kompetenz', 'thema', 'bezeichnung', 'knowledge_area'],
      },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        description: 'e.g. Knowledge Area, Subject-Specific Skill, Generic Skill',
        aliases: ['category', 'kategorie', 'area', 'group', 'type'],
      },
      {
        key: 'topic',
        label: 'Topic / Sub-theme',
        required: false,
        type: 'string',
        description: 'Specific topic under category',
        aliases: ['topic', 'subtopic', 'unterthema', 'subject'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description of the competency',
        aliases: ['description', 'beschreibung', 'details', 'definition', 'desc', 'learning_outcome'],
      },
      {
        key: 'level',
        label: 'Skill Level',
        required: false,
        type: 'enum',
        description: 'Introduction (I), Regular (R), Master (M)',
        options: ['Introduction', 'Regular', 'Master', 'I', 'R', 'M'],
        aliases: ['level', 'skill_level', 'niveau', 'stufe', 'kompetenzstufe'],
      },
    ],
    /**
     * Kap. 15.1/15.3: jede Kompetenz krijgt frameworkId (Pflicht).
     * resolveFramework(name) → id kommt vom Aufrufer (useCsvImport beim Save),
     * Fallback ohne Resolver: Standard-Rahmen-Slug aus framework_name.
     */
    transform: (mappedRows: Record<string, any>[], ctx?: { resolveFramework?: (name: string) => Promise<string> | string }): Competency[] => {
      return mappedRows.map((obj, idx) => {
        const name = String(obj.name || obj.topic || obj.category || 'Unnamed Competency')
        const frameworkId = ctx?.resolveFramework
          ? (Promise.resolve(ctx.resolveFramework(String(obj.framework_name || 'Standard'))).catch(() => '') as unknown as string)
          : `cf-${normalizeHeader(String(obj.framework_name || 'standard')) || 'standard'}`
        const comp: Competency = {
          frameworkId,
          name,
          order: obj.order != null ? Number(obj.order) : idx + 1,
        }
        if (obj.category) comp.category = String(obj.category)
        if (obj.topic) comp.topic = String(obj.topic)
        if (obj.description) comp.description = String(obj.description)
        if (obj.level) comp.level = String(obj.level) as SkillLevel
        return comp
      })
    },
  },

  modules: {
    type: 'modules',
    label: 'Modules',
    icon: 'mdi-book-open-page-variant',
    description: 'Curriculum modules, degree associations, credits, and contact hours.',
    entityName: 'Module',
    fields: [
      {
        key: 'name',
        label: 'Module Name',
        required: true,
        type: 'string',
        description: 'Full name of the module',
        aliases: ['name', 'module_name', 'module name', 'modul', 'modulname', 'title'],
      },
      {
        key: 'id',
        label: 'Module ID / Code',
        required: false,
        type: 'string',
        description: 'Unique module identifier or code (e.g. CS101)',
        aliases: ['id', 'code', 'module_code', 'module code', 'kuerzel', 'modulcode', 'identifier'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Module overview and syllabus',
        aliases: ['description', 'beschreibung', 'syllabus', 'details', 'desc', 'summary'],
      },
      {
        key: 'DegreeIDs',
        label: 'Degree IDs',
        required: false,
        type: 'string',
        description: 'Referenced degree IDs (comma, semicolon, or pipe separated)',
        aliases: [
          'degreeids',
          'degree_ids',
          'degree ids',
          'degreeid',
          'degree_id',
          'degrees',
          'degree',
          'degree_programmes',
          'abschluesse',
          'abschluss',
          'abschluss_ids',
        ],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or lecturer responsible for the module',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'lecturer', 'dozent', 'responsible', 'person', 'ansprechpartner'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or syllabus URL of the module',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
      {
        key: 'creditPoints',
        label: 'Credit Points (ECTS)',
        required: false,
        type: 'number',
        description: 'ECTS credits',
        aliases: ['creditpoints', 'credit_points', 'credits', 'ects', 'points'],
      },
      {
        key: 'contactHours',
        label: 'Contact Hours',
        required: false,
        type: 'number',
        description: 'Classroom teaching hours',
        aliases: ['contacthours', 'contact_hours', 'contact hours', 'kontaktzeit', 'praesenz'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Module[] => {
      return mappedRows.map(obj => {
        const mod: Module = {
          name: String(obj.name || ''),
        }
        if (obj.id) mod.id = String(obj.id)
        if (obj.code || obj.id) mod.code = String(obj.code || obj.id)
        if (obj.description) mod.description = String(obj.description)
        const degreeIds = parseStringArray(obj.DegreeIDs || obj.degreeIDs || obj.degreeIds)
        if (degreeIds.length > 0) {
          mod.DegreeIDs = degreeIds
          mod.degreeIDs = degreeIds
          mod.degreeIds = degreeIds
        }
        if (obj.contact) mod.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          mod.url = String(urlVal)
          mod.URL = String(urlVal)
        }
        if (obj.creditPoints !== undefined && obj.creditPoints !== '') {
          mod.creditPoints = Number(obj.creditPoints) || undefined
        }
        if (obj.contactHours !== undefined && obj.contactHours !== '') {
          mod.contactHours = Number(obj.contactHours) || undefined
        }
        return mod
      })
    },
  },

  learning_cycles: {
    type: 'learning_cycles',
    label: 'Module (Learning Cycles)',
    icon: 'mdi-cycle',
    description: 'Module with their six learning cycles, imported from the module Excel files (Schritt A: Extraktion).',
    entityName: 'Curriculum Module',
    fields: [
      {
        key: 'name',
        label: 'Module Name',
        required: true,
        type: 'string',
        description: 'Full name of the module (e.g. Strategy)',
        aliases: ['name', 'module_name', 'module name', 'modul', 'modulname', 'module_title', 'title'],
      },
      {
        key: 'program',
        label: 'Study Program',
        required: true,
        type: 'string',
        description: 'Master program the module belongs to (e.g. MBA)',
        aliases: ['program', 'study_program', 'study program', 'studiengang', 'program_name'],
      },
      {
        key: 'lc_number',
        label: 'Learning Cycle Number',
        required: true,
        type: 'number',
        description: 'Number of the learning cycle (1-6)',
        aliases: ['lc_number', 'lc nummer', 'learning_cycle_number', 'number', 'nr', 'nummer', 'lc', 'zyklus', 'lernzyklus_nr'],
      },
      {
        key: 'lc_title',
        label: 'Learning Cycle Title',
        required: false,
        type: 'string',
        description: 'Title of the learning cycle',
        aliases: ['lc_title', 'learning_cycle_title', 'title', 'titel', 'thema', 'topic', 'lernzyklus'],
      },
      {
        key: 'lc_content',
        label: 'Learning Cycle Content',
        required: true,
        type: 'string',
        description: 'Description text of the learning cycle (input for the similarity analysis; kept verbatim)',
        aliases: ['lc_content', 'learning_cycle_content', 'content', 'beschreibung', 'description', 'inhalt', 'text'],
      },
    ],
    /**
     * Kap. 12.4: programm (Freitext aus der Excel) wird NUR als Hinweis genommen;
     * die eigentlicheVerknüpfung geht über resolveProgram(name) → StudyProgram.id.
     * Der Aufrufer (Import-Dialog) übergibt den Resolver aus der study_programs-Tabelle.
     */
    transform: (mappedRows: Record<string, any>[], ctx?: { resolveProgram?: (name: string) => string }): CurriculumModule[] => {
      const byModule = new Map<string, CurriculumModule>()
      for (const obj of mappedRows) {
        const name = String(obj.name || '')
        const programName = String(obj.program || '')
        const lcNum = Number(obj.lc_number)
        if (!name || !Number.isFinite(lcNum)) continue
        // Ordnet Freitext auf die gewählte StudyProgram (= FK); fallback: normalisierter Name
        const studyProgramId = ctx?.resolveProgram
          ? ctx.resolveProgram(programName)
          : `prog-${normalizeHeader(programName)}`
        const key = `${studyProgramId}::${name}`
        let mod = byModule.get(key)
        if (!mod) {
          mod = {
            id: `mod-${normalizeHeader(studyProgramId)}-${normalizeHeader(name)}`,
            name,
            studyProgramId,
            semester: Number(obj.semester ?? obj.lc_semester ?? 0),
            program: programName,
            learningCycles: [],
          }
          byModule.set(key, mod)
        }
        if (lcNum < 1 || lcNum > 6) continue
        const n = lcNum as LearningCycle['number']
        mod.learningCycles.push({
          id: `${mod.id}-lc${n}`,
          moduleId: mod.id,
          number: n,
          structuralElement: `Learning Cycle ${n}`,
          learningGoals: String(obj.lc_goals || obj.lc_content || ''),
          mainContent: String(obj.lc_content || ''),
          didactics: String(obj.lc_didactics || ''),
          assignmentDescription: obj.lc_assignment || undefined,
          assignmentType: obj.lc_assignmentType,
          gradingPercentage: obj.lc_grading != null ? Number(obj.lc_grading) : undefined,
          title: String(obj.lc_title || ''),
          content: String(obj.lc_content || ''),
          sourceFile: String(obj.source_file || ''),
          sourceRow: n,
          version: 'v1',
        })
      }
      // Sort learning cycles and modules for stable output
      const mods = [...byModule.values()]
      for (const m of mods) m.learningCycles.sort((a, b) => a.number! - b.number!)
      mods.sort((a, b) => (a.program ?? '').localeCompare(b.program ?? '') || a.name.localeCompare(b.name))
      return mods
    },
  },

  study_programs: {
    type: 'study_programs',
    label: 'Study Programs',
    icon: 'mdi-school-outline',
    description: 'Degree study programs (BSc, MSc, MAS, etc.).',
    entityName: 'Study Program',
    fields: [
      {
        key: 'name',
        label: 'Program Name',
        required: true,
        type: 'string',
        description: 'Name of the degree program',
        aliases: ['name', 'program_name', 'program name', 'studiengang', 'study_program', 'title'],
      },
      {
        key: 'degreeType',
        label: 'Degree Type',
        required: false,
        type: 'string',
        description: 'e.g. BSc, MSc, Certificate',
        aliases: ['degreetype', 'degree_type', 'degree', 'abschluss', 'type'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Program description',
        aliases: ['description', 'beschreibung', 'details'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): StudyProgram[] => {
      return mappedRows.map(obj => {
        const sp: StudyProgram = {
          name: String(obj.name || ''),
        }
        if (obj.degreeType) sp.degreeType = String(obj.degreeType)
        if (obj.description) sp.description = String(obj.description)
        return sp
      })
    },
  },

  departments: {
    type: 'departments',
    label: 'Departments',
    icon: 'mdi-domain',
    description: 'Academic departments, faculties, or administrative units.',
    entityName: 'Department',
    fields: [
      {
        key: 'name',
        label: 'Department Name',
        required: true,
        type: 'string',
        description: 'Name of the department',
        aliases: ['name', 'department_name', 'department name', 'departement', 'dept_name', 'title', 'fachbereich', 'institut'],
      },
      {
        key: 'id',
        label: 'Department ID',
        required: false,
        type: 'string',
        description: 'Unique department identifier',
        aliases: ['id', 'department_id', 'department id', 'dept_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description of the department',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner', 'leitung'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the department',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Department[] => {
      return mappedRows.map(obj => {
        const dept: Department = {
          name: String(obj.name || ''),
        }
        if (obj.id) dept.id = String(obj.id)
        if (obj.description) dept.description = String(obj.description)
        if (obj.contact) dept.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          dept.url = String(urlVal)
          dept.URL = String(urlVal)
        }
        return dept
      })
    },
  },

  programs: {
    type: 'programs',
    label: 'Programs',
    icon: 'mdi-school-outline',
    description: 'Structured courses of study and academic programs.',
    entityName: 'Program',
    fields: [
      {
        key: 'name',
        label: 'Program Name',
        required: true,
        type: 'string',
        description: 'Name of the program',
        aliases: ['name', 'program_name', 'program name', 'studiengang', 'study_program', 'title'],
      },
      {
        key: 'id',
        label: 'Program ID',
        required: false,
        type: 'string',
        description: 'Unique program identifier',
        aliases: ['id', 'program_id', 'program id', 'studiengang_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the program',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'departmentIDs',
        label: 'Department IDs',
        required: false,
        type: 'string',
        description: 'Referenced department IDs (comma, semicolon, or pipe separated)',
        aliases: [
          'departmentids',
          'department_ids',
          'department ids',
          'departmentid',
          'department_id',
          'departments',
          'department',
          'departement',
          'dept_ids',
          'dept_id',
        ],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner', 'studiengangsleitung'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the program',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Program[] => {
      return mappedRows.map(obj => {
        const prog: Program = {
          name: String(obj.name || ''),
        }
        if (obj.id) prog.id = String(obj.id)
        if (obj.description) prog.description = String(obj.description)
        const deptIds = parseStringArray(obj.departmentIDs || obj.departmentIds)
        if (deptIds.length > 0) {
          prog.departmentIDs = deptIds
          prog.departmentIds = deptIds
        }
        if (obj.contact) prog.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          prog.url = String(urlVal)
          prog.URL = String(urlVal)
        }
        return prog
      })
    },
  },

  degrees: {
    type: 'degrees',
    label: 'Degrees',
    icon: 'mdi-certificate-outline',
    description: 'Academic qualifications awarded upon program completion.',
    entityName: 'Degree',
    fields: [
      {
        key: 'name',
        label: 'Degree Name',
        required: true,
        type: 'string',
        description: 'Name of the degree qualification (e.g. Bachelor of Science)',
        aliases: ['name', 'degree_name', 'degree name', 'abschluss', 'degree', 'title', 'titel', 'abschlussbezeichnung'],
      },
      {
        key: 'id',
        label: 'Degree ID',
        required: false,
        type: 'string',
        description: 'Unique degree identifier',
        aliases: ['id', 'degree_id', 'degree id', 'abschluss_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the degree',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'ProgramIDs',
        label: 'Program IDs',
        required: false,
        type: 'string',
        description: 'Referenced program IDs (comma, semicolon, or pipe separated)',
        aliases: [
          'programids',
          'program_ids',
          'program ids',
          'programid',
          'program_id',
          'programs',
          'program',
          'studiengaenge',
          'studiengang',
          'studiengang_ids',
        ],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the degree',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Degree[] => {
      return mappedRows.map(obj => {
        const deg: Degree = {
          name: String(obj.name || ''),
        }
        if (obj.id) deg.id = String(obj.id)
        if (obj.description) deg.description = String(obj.description)
        const progIds = parseStringArray(obj.ProgramIDs || obj.programIDs || obj.programIds)
        if (progIds.length > 0) {
          deg.ProgramIDs = progIds
          deg.programIDs = progIds
          deg.programIds = progIds
        }
        if (obj.contact) deg.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          deg.url = String(urlVal)
          deg.URL = String(urlVal)
        }
        return deg
      })
    },
  },

  proofs_of_competency: {
    type: 'proofs_of_competency',
    label: 'Proofs of Competency',
    icon: 'mdi-file-certificate-outline',
    description: 'Assessment methods, exams, assignments, and duration.',
    entityName: 'Proof of Competency',
    fields: [
      {
        key: 'name',
        label: 'Name',
        required: true,
        type: 'string',
        description: 'Name or title of the proof of competency (e.g. Final Written Exam)',
        aliases: ['name', 'title', 'bezeichnung', 'pruefung', 'exam', 'assessment', 'proof', 'proof_name'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description or criteria for the assessment',
        aliases: ['description', 'beschreibung', 'details', 'criteria', 'desc'],
      },
      {
        key: 'answerFormats',
        label: 'Answer Formats',
        required: false,
        type: 'enum',
        description: 'Comma/pipe separated list: written, oral, multipleChoice, freeText',
        options: ['written', 'oral', 'multipleChoice', 'freeText', 'Written', 'Oral', 'Multiple Choice', 'Free Text', 'schriftlich', 'muendlich'],
        aliases: ['answerformats', 'answer_formats', 'answer formats', 'formats', 'format', 'assessmenttype', 'assessment_type', 'multiplechoice', 'multiple_choice', 'freetext', 'free_text', 'art', 'form'],
      },
      {
        key: 'assignmentScope',
        label: 'Assignment Type (Individual / Group)',
        required: false,
        type: 'enum',
        description: 'individual or group',
        options: ['individual', 'group', 'Individual', 'Group', 'einzelarbeit', 'gruppenarbeit'],
        defaultValue: 'individual',
        aliases: ['assignmentscope', 'assignment_scope', 'assignment_type', 'individual_group', 'group_assignment', 'scope'],
      },
      {
        key: 'durationMinutes',
        label: 'Duration of Test (min)',
        required: false,
        type: 'number',
        description: 'Test duration in minutes',
        aliases: ['durationminutes', 'duration_minutes', 'duration', 'dauer', 'pruefungsdauer', 'minutes', 'minuten', 'zeit'],
      },
      {
        key: 'competencyIds',
        label: 'Competency IDs',
        required: false,
        type: 'string',
        description: 'Referenced competency IDs (comma, semicolon, or pipe separated)',
        aliases: ['competencyids', 'competency_ids', 'competency ids', 'competencyid', 'competency_id', 'competencies', 'kompetenzen'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): ProofOfCompetency[] => {
      return mappedRows.map(obj => {
        const formats: AnswerFormat[] = []
        const raw = obj.answerFormats !== undefined
          ? obj.answerFormats
          : [obj.written, obj.oral].filter(v => v !== undefined && v !== '')
        for (const f of parseStringArray(raw)) {
          const norm = f.toLowerCase().replace(/[\s_-]/g, '')
          if (norm === 'written' || norm === 'schriftlich') formats.push('written')
          else if (norm === 'oral' || norm === 'muendlich') formats.push('oral')
          else if (norm === 'multiplechoice' || norm === 'mc') formats.push('multipleChoice')
          else if (norm === 'freetext' || norm === 'essay') formats.push('freeText')
        }

        let assignmentScope: 'individual' | 'group' = 'individual'
        const as = String(obj.assignmentScope || '').toLowerCase().trim()
        if (as.includes('group') || as.includes('grupp')) {
          assignmentScope = 'group'
        }

        const proof: ProofOfCompetency = {
          name: String(obj.name || 'Unnamed Proof of Competency'),
          answerFormats: formats,
          assignmentScope,
        }

        if (obj.description) proof.description = String(obj.description)
        if (obj.durationMinutes !== undefined && obj.durationMinutes !== '') {
          proof.durationMinutes = Number(obj.durationMinutes) || undefined
        }
        const compIds = parseStringArray(obj.competencyIds)
        if (compIds.length > 0) proof.competencyIds = compIds

        return proof
      })
    },
  },

  matrix_competencies: {
    type: 'matrix_competencies',
    label: 'Matrix Competencies',
    icon: 'mdi-view-grid',
    description: 'Competency matrix axes (x/y) for curriculum mapping.',
    entityName: 'Matrix Competency',
    fields: [
      {
        key: 'competencyMatrixId',
        label: 'Matrix ID',
        required: false,
        type: 'string',
        description: 'ID of the parent competency matrix',
        aliases: ['competencymatrixid', 'competency_matrix_id', 'matrix_id', 'matrixid', 'matrix'],
      },
      {
        key: 'name',
        label: 'Name',
        required: true,
        type: 'string',
        description: 'Name of the matrix competency axis',
        aliases: ['name', 'title', 'bezeichnung', 'kompetenz'],
      },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        description: 'Category of the competency',
        aliases: ['category', 'kategorie', 'area', 'group', 'type'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the matrix competency',
        aliases: ['description', 'beschreibung', 'details', 'desc'],
      },
      {
        key: 'level',
        label: 'Level',
        required: false,
        type: 'string',
        description: 'Competency level',
        aliases: ['level', 'niveau', 'stufe', 'kompetenzstufe'],
      },
      {
        key: 'matrixAxis',
        label: 'Matrix Axis',
        required: true,
        type: 'enum',
        description: 'Whether this competency defines the x-axis or y-axis',
        options: ['x', 'y'],
        defaultValue: 'x',
        aliases: ['matrixaxis', 'matrix_axis', 'axis', 'achse'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): MatrixCompetency[] => {
      return mappedRows.map(obj => {
        const mc: MatrixCompetency = {
          name: String(obj.name || 'Unnamed Matrix Competency'),
          matrixAxis: obj.matrixAxis === 'y' ? 'y' : 'x',
        }
        if (obj.competencyMatrixId) mc.competencyMatrixId = String(obj.competencyMatrixId)
        if (obj.category) mc.category = String(obj.category)
        if (obj.description) mc.description = String(obj.description)
        if (obj.level) mc.level = String(obj.level)
        return mc
      })
    },
  },
  proofs_of_knowledge: {
    type: 'proofs_of_knowledge',
    label: 'Proofs of Knowledge',
    icon: 'mdi-file-certificate-outline',
    description: 'Assessment methods, exams, assignments, and duration.',
    entityName: 'Proof of Knowledge',
    fields: [
      {
        key: 'name',
        label: 'Name',
        required: true,
        type: 'string',
        description: 'Name or title of the proof of knowledge (e.g. Final Written Exam)',
        aliases: ['name', 'title', 'bezeichnung', 'pruefung', 'exam', 'assessment', 'proof', 'proof_name'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description or criteria for the assessment',
        aliases: ['description', 'beschreibung', 'details', 'criteria', 'desc'],
      },
      {
        key: 'assessmentType',
        label: 'Format (Written / Oral)',
        required: false,
        type: 'enum',
        description: 'written or oral',
        options: ['written', 'oral', 'Written', 'Oral', 'schriftlich', 'muendlich'],
        defaultValue: 'written',
        aliases: ['assessmenttype', 'assessment_type', 'format', 'type', 'art', 'written_oral', 'form'],
      },
      {
        key: 'multipleChoice',
        label: 'Multiple Choice Questions',
        required: false,
        type: 'boolean',
        description: 'Whether multiple choice questions are included (true/false)',
        aliases: ['multiplechoice', 'multiple_choice', 'mc', 'multiple choice', 'single_choice'],
      },
      {
        key: 'freeText',
        label: 'Free Text Questions',
        required: false,
        type: 'boolean',
        description: 'Whether free text questions are included (true/false)',
        aliases: ['freetext', 'free_text', 'free text', 'freitext', 'essay', 'open_questions'],
      },
      {
        key: 'assignmentScope',
        label: 'Assignment Type (Individual / Group)',
        required: false,
        type: 'enum',
        description: 'individual or group',
        options: ['individual', 'group', 'Individual', 'Group', 'einzelarbeit', 'gruppenarbeit'],
        defaultValue: 'individual',
        aliases: ['assignmentscope', 'assignment_scope', 'assignment_type', 'individual_group', 'group_assignment', 'scope'],
      },
      {
        key: 'durationMinutes',
        label: 'Duration of Test (min)',
        required: false,
        type: 'number',
        description: 'Test duration in minutes',
        aliases: ['durationminutes', 'duration_minutes', 'duration', 'dauer', 'pruefungsdauer', 'minutes', 'minuten', 'zeit'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): ProofOfKnowledge[] => {
      return mappedRows.map(obj => {
        let assessmentType: AssessmentForm = 'written'
        const at = String(obj.assessmentType || '').toLowerCase().trim()
        if (at.includes('oral') || at.includes('muend')) {
          assessmentType = 'oral'
        }

        let assignmentScope: AssignmentScope = 'individual'
        const as = String(obj.assignmentScope || '').toLowerCase().trim()
        if (as.includes('group') || as.includes('grupp')) {
          assignmentScope = 'group'
        }

        const proof: ProofOfKnowledge = {
          name: String(obj.name || 'Unnamed Proof of Knowledge'),
          assessmentType,
          multipleChoice: parseBoolean(obj.multipleChoice),
          freeText: parseBoolean(obj.freeText),
          assignmentScope,
        }

        if (obj.description) proof.description = String(obj.description)
        if (obj.durationMinutes !== undefined && obj.durationMinutes !== '') {
          proof.durationMinutes = Number(obj.durationMinutes) || undefined
        }

        return proof
      })
    },
  },}

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (!val) return false
  const s = String(val).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'ja' || s === 't'
}
