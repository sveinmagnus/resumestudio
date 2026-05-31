import { Router, type Request, type Response } from 'express'
import { getResume, saveResume, getLastSavedAt, listSnapshots, getSnapshot } from '../db.js'

const router = Router()

/** GET /api/resume/snapshots — list restore points (metadata only). */
router.get('/snapshots', (_req: Request, res: Response): void => {
  res.json({ snapshots: listSnapshots() })
})

/** GET /api/resume/snapshots/:id — return one snapshot's full resume data. */
router.get('/snapshots/:id', (req: Request, res: Response): void => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid snapshot id' })
    return
  }
  const data = getSnapshot(id)
  if (!data) {
    res.status(404).json({ error: 'Snapshot not found' })
    return
  }
  res.json({ data })
})

/** GET /api/resume — return stored resume data, 404 if empty. */
router.get('/', (_req: Request, res: Response): void => {
  const data = getResume()
  if (!data) {
    res.status(404).json({ error: 'No resume stored yet' })
    return
  }
  res.json({ data, saved_at: getLastSavedAt() })
})

/** PUT /api/resume — replace stored resume data. */
router.put('/', (req: Request, res: Response): void => {
  const body = req.body as unknown
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' })
    return
  }
  const saved_at = saveResume(body)
  res.json({ ok: true, saved_at })
})

export default router
