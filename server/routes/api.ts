/**
 * Generische Entity-CRUD für den JSONB/entity_store (alle Programm-Objekte).
 * Mit Tabellen-Allowlist (Review) für bekannte Entitäten.
 */
import { Router, Request, Response } from 'express'
import {
  getAllEntities,
  getEntityById,
  saveEntity,
  deleteEntity,
  isDbConnected,
} from '../db'

/**
 * Allowlist gültiger Entity-Tabellen (Review #5): beliebige Tabellennamen
 * konnten ohne Prüfung generiert werden. Ergänzungen bewusst hier und im
 * Client zentral erweitern.
 */
export const ALLOWED_ENTITY_TABLES = new Set([
  'curriculum_versions',
  'study_programs',
  'programs',
  'modules',
  'learning_cycles',
  'curriculum_modules',
  'semesters',
  'terms',
  'themes',
  'lessons',
  'rooms',
  'locations',
  'lecturers',
  'instructors',
  'instructor_availability',
  'contact_blocks',
  'communications',
  'rubrics',
  'taxonomy_items',
  'objectives',
  'objective_relationships',
  'objective_mappings',
  'competencies',
  'competency_frameworks',
  'proof_of_knowledge',
  'proofs_of_knowledge',
  'assessment_results',
  'assessments',
  'improvement_actions',
  'administrators',
  'todos',
  'mapping_reviews',
])

function requireEntity(entity: string, res: Response): string | null {
  if (ALLOWED_ENTITY_TABLES.has(entity)) return entity
  res.status(404).json({ error: `Unbekannte Entity-Tabelle: ${entity}` })
  return null
}

export const apiRouter = Router()

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    databaseConnected: isDbConnected(),
    timestamp: new Date().toISOString(),
  })
})

// GET all items for an entity table
apiRouter.get('/:entity', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const items = await getAllEntities(entity)
    res.json(items)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch entities' })
  }
})

// GET single item by ID
apiRouter.get('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const id = String(req.params.id)
    const item = await getEntityById(entity, id)
    if (!item) {
      res.status(404).json({ error: `Entity not found in ${entity}` })
      return
    }
    res.json(item)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch entity' })
  }
})

// POST create a new item
apiRouter.post('/:entity', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const body = req.body || {}
    const id = body.id || body._id || `cw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const saved = await saveEntity(entity, id, { ...body, id, _id: id })
    res.status(201).json(saved)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create entity' })
  }
})

// PUT replace / update an item
apiRouter.put('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const id = String(req.params.id)
    const body = req.body || {}
    const existing = (await getEntityById(entity, id)) || {}
    const updated = await saveEntity(entity, id, { ...existing, ...body, id, _id: id })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update entity' })
  }
})

// PATCH partial update
apiRouter.patch('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const id = String(req.params.id)
    const body = req.body || {}
    const existing = (await getEntityById(entity, id)) || {}
    const updated = await saveEntity(entity, id, { ...existing, ...body, id, _id: id })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to patch entity' })
  }
})

// DELETE an item
apiRouter.delete('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const id = String(req.params.id)
    const deleted = await deleteEntity(entity, id)
    if (!deleted) {
      res.status(404).json({ error: `Entity not found in ${entity}` })
      return
    }
    res.json({ deleted: true, id })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete entity' })
  }
})

// Database status endpoint
apiRouter.get('/db/status', (_req: Request, res: Response) => {
  res.json({ connected: isDbConnected() })
})
