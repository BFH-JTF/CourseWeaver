import { Router, Request, Response } from 'express'
import {
  getAllEntities,
  getEntityById,
  saveEntity,
  deleteEntity,
  isDbConnected,
} from '../db'

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
    const entity = String(req.params.entity)
    const items = await getAllEntities(entity)
    res.json(items)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch entities' })
  }
})

// GET single item by ID
apiRouter.get('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = String(req.params.entity)
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
    const entity = String(req.params.entity)
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
    const entity = String(req.params.entity)
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
    const entity = String(req.params.entity)
    const id = String(req.params.id)
    const body = req.body || {}
    const existing = (await getEntityById(entity, id)) || {}
    const updated = await saveEntity(entity, id, { ...existing, ...body, id, _id: id })
    res.json(updated)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to patch entity' })
  }
})

// DELETE item
apiRouter.delete('/:entity/:id', async (req: Request, res: Response) => {
  try {
    const entity = String(req.params.entity)
    const id = String(req.params.id)
    const success = await deleteEntity(entity, id)
    res.json({ success, id })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete entity' })
  }
})
