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
  getEntityAdmins,
  addEntityAdmin,
  removeEntityAdmin,
  isEntityAdmin,
  getEntitiesWhereUserIsAdmin,
  getUserByOidc,
  getAllUsers,
} from '../db'
import { authRouter } from './auth'
import { usersRouter } from './users'
import { AuthenticatedRequest, extractOidcClaims } from '../auth'
import { ROLE_LEVEL, RbacRole, resolveEntityRole, setEntityRole, listEntityRoles, removeEntityRole } from '../db'

const SUPERUSER_TABLES = new Set(['curriculum_versions', 'classes',
 'semesters', 'lessons', 'lecturers', 'weeks', 'schedule_entries'])

/**
 * Allowlist gültiger Entity-Tabellen (Review #5): beliebige Tabellennamen
 * konnten ohne Prüfung generiert werden. Ergänzungen bewusst hier und im
 * Client zentral erweitern.
 */
export const ALLOWED_ENTITY_TABLES = new Set([
  'curriculum_versions',
  'study_programs',
  'lc_contents',
  'programs',
  'modules',
  'classes',

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

  'proofs_of_competency',
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

// Authentication & bootstrap routes
apiRouter.use('/auth', authRouter)

// User & role management routes
apiRouter.use('/users', usersRouter)

// ─── RBAC: geordnete Stufen (reader 0 < user 1 < superuser 2 < admin 3) ────────
// Matrix (Requirement 29.09.2026):
//   view            → reader(0)+      — alle Authentifizierten (und Anonymous im Dev)
//   editOwn         → user(1)+        wenn object-admin/creator, sonst superuser
//   editForeign     → superuser(2)+   (Module fremder Programme)
//   releaseVersion  → superuser(2)+   (curriculum_versions)
//   manageStructure → admin(3)+       (departments/programs/degrees anlegen)
//   manageRoles     → admin(3)+       (Rollen vergeben; nur global admin)

const STRUCTURE_TABLES = new Set(['departments', 'programs', 'degrees', 'study_programs'])
const RELEASE_TABLES = new Set(['curriculum_versions'])

async function effectiveRoleLevel(req: Request, entity: string, entityId?: string): Promise<number> {
  const claims = extractOidcClaims(req)
  const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
  const isGlobalAdmin = localUser?.is_admin ?? false
  // Dev-Kompatibilität (keine OIDC gesetzt, kein API-Auth): unauthentifizierte
  /// Requests gelten als global admin (Historie/Logs des Bestandsmodells).
  if (!claims && !process.env.API_AUTH_TOKEN) return ROLE_LEVEL.admin
  if (isGlobalAdmin) return ROLE_LEVEL.admin
  const resolved = entityId ? await resolveEntityRole(localUser!.id, entity, entityId) : 'reader'
  return ROLE_LEVEL[resolved]
}

async function requireMutationRight(req: Request, res: Response, entity: string, entityId?: string): Promise<void> {
  const claims = extractOidcClaims(req)
  const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
  const isGlobalAdmin = localUser?.is_admin ?? false
  const claims_missing = !claims

  // Dev-Bypass unverändert (keine Auth getestest in der Suite)
  if (claims_missing && !process.env.API_AUTH_TOKEN) return

  // Struktur-Tabellen & Schnittstellen-Tabellen: nur global admin (3)
  if (STRUCTURE_TABLES.has(entity) || STRUCTURE_TABLES.has(entity) ) {
    if (!isGlobalAdmin) { res.status(403).json({ error: 'Nur globale Administratoren (admin) dürfen Struktur-Metadaten ändern' }); return }
  }
  if (RELEASE_TABLES.has(entity)) {
    if (!isGlobalAdmin) {
      // superuser(2)+ darf freigeben
      const lvl = await effectiveRoleLevel(req, entity, entityId)
      if (lvl < ROLE_LEVEL.superuser) { res.status(403).json({ error: 'Freigabe erfordert superuser oder admin' }); return }
    }
  }

  // Entitäten (z.B. Module): resolveEntityRole → bewertet
  const level = await effectiveRoleLevel(req, entity, entityId)
  if (level >= ROLE_LEVEL.admin) return
  // superuser (2) darf fremde Programme bearbeiten
  if (level >= ROLE_LEVEL.superuser) return
  // user (1) darf eigene: object-admin ODER created_by
  if (localUser && (await isEntityAdmin(entity, entityId!, localUser.id))) return
  if (localUser && entityId) {
    const row = await getEntityById(entity, entityId)
    if (row && (row.created_by === localUser.id)) return
  }
  if (level >= ROLE_LEVEL.user && localUser && !entityId) return // create on own scope
  res.status(403).json({ error: 'Keine Berechtigung (RBAC-Stufe zu tief)' })
  return
}


// ─── RBAC-Rollen-Zuweisungen (CRUD fürs künftige Admin-Tool) ───────────────────
// Nur globale Administratoren (admin, Stufe 3) dürfen Zuweisungen verwalten.

apiRouter.get('/rbac/roles', async (req: Request, res: Response) => {
  try {
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = localUser?.is_admin ?? false
    if (!claims && !process.env.API_AUTH_TOKEN) { /* dev bypass */ } else if (!isGlobalAdmin) {
      res.status(403).json({ error: 'Nur globale Administratoren dürfen Rollen einsehen' })
      return
    }
    res.json(await listEntityRoles(String(req.query.entityType ?? '') || undefined))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load roles' })
  }
})

apiRouter.put('/rbac/roles', async (req: Request, res: Response) => {
  try {
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = localUser?.is_admin ?? false
    if (claims && !isGlobalAdmin) {
      res.status(403).json({ error: 'Nur globale Administratoren dürfen Rollen vergeben' })
      return
    }
    const { userId, entityType, entityId, role } = req.body || {}
    if (!userId || !entityType || !entityId || !role) {
      res.status(400).json({ error: 'userId, entityType, entityId und role erforderlich' })
      return
    }
    if (!['reader', 'user', 'superuser', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Unbekannte Rolle' })
      return
    }
    await setEntityRole(String(userId), String(entityType), String(entityId), role as any)
    res.json({ success: true, userId, entityType, entityId, role })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to set role' })
  }
})

apiRouter.delete('/rbac/roles', async (req: Request, res: Response) => {
  try {
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    if (claims && !localUser?.is_admin) {
      res.status(403).json({ error: 'Nur globale Administratoren dürfen Rollen löschen' })
      return
    }
    const { userId, entityType, entityId } = req.body || {}
    await removeEntityRole(String(userId), String(entityType), String(entityId))
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove role' })
  }
})

apiRouter.get('/rbac/me', async (req: Request, res: Response) => {
  try {
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    if (!claims) { res.json({ role: process.env.API_AUTH_TOKEN ? 'reader' : 'admin', dev: true }); return }
    if (!localUser) { res.status(404).json({ error: 'User unbekannt' }); return }
    const role = localUser.is_admin ? 'admin' : await resolveEntityRole(localUser.id, String(req.query.entityType ?? 'module'), String(req.query.entityId ?? ''))
    res.json({ role, userId: localUser.id, isGlobalAdmin: localUser.is_admin ?? false })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ─── ACL Admin Routes ──────────────────────────────────────────────────────────

// GET admins for an entity
apiRouter.get('/:entity/:id/admins', async (req: Request, res: Response) => {
  try {
    const entity = String(req.params.entity)
    const id = String(req.params.id)
    const admins = await getEntityAdmins(entity, id)
    const users = await getAllUsers()
    const enriched = admins.map(acl => {
      const user = users.find(u => u.id === acl.user_id)
      return {
        ...acl,
        name: user?.name || acl.user_id,
        email: user?.email || '',
      }
    })
    res.json(enriched)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch admins' })
  }
})

// POST add an admin to an entity
apiRouter.post('/:entity/:id/admins', async (req: Request, res: Response) => {
  try {
    const entity = String(req.params.entity)
    const id = String(req.params.entity) === entity ? req.params.id : String(req.params.id)
    const entityId = String(req.params.id)
    const userId = req.body?.userId
    if (!userId) {
      res.status(400).json({ error: 'userId is required' })
      return
    }

    const claims = extractOidcClaims(req)
    const callerId = claims ? (await getUserByOidc(claims.iss, claims.sub))?.id : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (!isGlobalAdmin) {
      if (!callerId || !(await isEntityAdmin(entity, entityId, callerId))) {
        res.status(403).json({ error: 'Only object admins can add administrators' })
        return
      }
    }

    const existing = await getEntityAdmins(entity, entityId)
    if (existing.length === 0) {
      res.status(404).json({ error: 'Entity not found' })
      return
    }

    const result = await addEntityAdmin(entity, entityId, userId)
    if (!result) {
      res.status(409).json({ error: 'User is already an admin of this entity' })
      return
    }
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to add admin' })
  }
})

// DELETE remove an admin from an entity
apiRouter.delete('/:entity/:id/admins/:userId', async (req: Request, res: Response) => {
  try {
    const entity = String(req.params.entity)
    const entityId = String(req.params.id)
    const targetUserId = String(req.params.userId)

    const claims = extractOidcClaims(req)
    const callerId = claims ? (await getUserByOidc(claims.iss, claims.sub))?.id : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (!isGlobalAdmin) {
      if (!callerId || !(await isEntityAdmin(entity, entityId, callerId))) {
        res.status(403).json({ error: 'Only object admins can remove administrators' })
        return
      }
    }

    const admins = await getEntityAdmins(entity, entityId)
    if (admins.length <= 1) {
      res.status(400).json({ error: 'Cannot remove the last administrator of an object' })
      return
    }

    const removed = await removeEntityAdmin(entity, entityId, targetUserId)
    if (!removed) {
      res.status(404).json({ error: 'Admin entry not found' })
      return
    }
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove admin' })
  }
})

// ─── Entity CRUD Routes (with ACL) ────────────────────────────────────────────

// GET all items for an entity table
apiRouter.get('/:entity', async (req: Request, res: Response) => {
  try {
    const entity = requireEntity(String(req.params.entity), res)
    if (!entity) return
    const items = await getAllEntities(entity)

    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    const adminEntities = isGlobalAdmin ? [] : localUser ? await getEntitiesWhereUserIsAdmin(localUser.id) : []
    const adminSet = new Set(adminEntities.map(e => `${e.table_name}::${e.entity_id}`))

    // Determine which entity types are "parent" to entities where user is admin
    let parentIds: Set<string> | null = null
    if (!isGlobalAdmin) {
      parentIds = new Set<string>()
      for (const ae of adminEntities ?? []) {
        // Walk up: modules -> degrees, degrees -> programs, programs -> departments
        if (ae.table_name === 'modules') {
          const mod = items.find((i: any) => i.id === ae.entity_id)
          if (mod) {
            const degreeIds = mod.DegreeIDs ?? mod.degreeIDs ?? mod.degreeIds ?? []
            for (const did of degreeIds) {
              if (did) parentIds!.add(`degrees::${did}`)
            }
          }
        }
        if (ae.table_name === 'degrees') {
          const deg = items.find((i: any) => i.id === ae.entity_id)
          if (deg) {
            const progIds = deg.ProgramIDs ?? deg.programIDs ?? deg.programIds ?? []
            for (const pid of progIds) {
              if (pid) parentIds!.add(`programs::${pid}`)
            }
          }
        }
        if (ae.table_name === 'programs') {
          const prog = items.find((i: any) => i.id === ae.entity_id)
          if (prog) {
            const deptIds = prog.departmentIDs ?? prog.departmentIds ?? []
            for (const did of deptIds) {
              if (did) parentIds!.add(`departments::${did}`)
            }
          }
        }
      }
    }

    const enriched = items.map((item: any) => {
      const key = `${entity}::${item.id}`
      const canEdit = isGlobalAdmin || adminSet.has(key)
      const isAdmin = canEdit || (parentIds ? parentIds.has(key) : false)
      return {
        ...item,
        _canEdit: canEdit,
        _isAdmin: isAdmin,
      }
    })
    res.json(enriched)
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

    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN
    const canEdit = isGlobalAdmin || (localUser ? await isEntityAdmin(entity, id, localUser.id) : false)

    res.json({ ...item, _canEdit: canEdit, _isAdmin: canEdit })
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
    await requireMutationRight(req, res, entity, undefined)
    if (res.headersSent) return
    const id = body.id || body._id || `cw_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Creator becomes admin unless it's a superuser-only table
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (SUPERUSER_TABLES.has(entity) && !isGlobalAdmin) {
      res.status(403).json({ error: 'Only global administrators can create this entity type' })
      return
    }

    const saved = await saveEntity(entity, id, { ...body, id, _id: id, created_by: localUser?.id || undefined })

    if (localUser && !SUPERUSER_TABLES.has(entity)) {
      await addEntityAdmin(entity, id, localUser.id)
    }

    res.status(201).json({ ...saved, _canEdit: true, _isAdmin: true })
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

    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (SUPERUSER_TABLES.has(entity) && !isGlobalAdmin) {
      res.status(403).json({ error: 'Only global administrators can edit this entity type' })
      return
    }

    if (!isGlobalAdmin && localUser && !(await isEntityAdmin(entity, id, localUser.id))) {
      res.status(403).json({ error: 'You are not an administrator of this object' })
      return
    }

    const existing = (await getEntityById(entity, id)) || {}
    const updated = await saveEntity(entity, id, { ...existing, ...body, id, _id: id })
    res.json({ ...updated, _canEdit: true, _isAdmin: true })
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
    await requireMutationRight(req, res, entity, id)
    if (res.headersSent) return

    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (SUPERUSER_TABLES.has(entity) && !isGlobalAdmin) {
      res.status(403).json({ error: 'Only global administrators can edit this entity type' })
      return
    }

    if (!isGlobalAdmin && localUser && !(await isEntityAdmin(entity, id, localUser.id))) {
      res.status(403).json({ error: 'You are not an administrator of this object' })
      return
    }

    const existing = (await getEntityById(entity, id)) || {}
    const updated = await saveEntity(entity, id, { ...existing, ...body, id, _id: id })
    res.json({ ...updated, _canEdit: true, _isAdmin: true })
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
    await requireMutationRight(req, res, entity, id)
    if (res.headersSent) return
    const claims = extractOidcClaims(req)
    const localUser = claims ? await getUserByOidc(claims.iss, claims.sub) : null
    const isGlobalAdmin = claims
  ? (await getUserByOidc(claims.iss, claims.sub))?.is_admin ?? false
  : !process.env.API_AUTH_TOKEN

    if (SUPERUSER_TABLES.has(entity) && !isGlobalAdmin) {
      res.status(403).json({ error: 'Only global administrators can delete this entity type' })
      return
    }

    if (!isGlobalAdmin && localUser && !(await isEntityAdmin(entity, id, localUser.id))) {
      res.status(403).json({ error: 'You are not an administrator of this object' })
      return
    }

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
