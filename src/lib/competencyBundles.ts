import type { KeyQualification } from '../types'

/**
 * Pure logic for the "By profile" competency view's drag-and-drop, where a
 * competency chip is dragged from one profile group to another to reassign its
 * membership. Membership is the single source of truth on each profile's
 * `competency_ids` bundle, so a move is expressed as a set of per-profile
 * patches. Kept out of the component so the branching (already-present guard,
 * the Unassigned bucket, "leave other profiles untouched") is unit-testable.
 */

/** Sentinel group id for the bucket of competencies attached to no profile. */
export const UNASSIGNED_GROUP = '__unassigned__'

/** The new `competency_ids` for one profile after a reassignment. */
export interface BundlePatch {
  profileId: string
  competency_ids: string[]
}

/**
 * Encode/decode a draggable chip's id. It carries BOTH the source group and the
 * competency because one competency can appear under several profiles at once —
 * a drop must only detach the specific instance that was dragged.
 */
export function chipDragId(group: string, competencyId: string): string {
  return `${group}|${competencyId}`
}

export function parseChipDragId(id: string): { group: string; competencyId: string } | null {
  const sep = id.indexOf('|')
  if (sep < 0) return null
  const competencyId = id.slice(sep + 1)
  if (!competencyId) return null
  return { group: id.slice(0, sep), competencyId }
}

/**
 * The profile-bundle patches produced by dragging `competencyId` from
 * `sourceGroup` to `targetGroup` (each a profile id or `UNASSIGNED_GROUP`).
 * Detaches from the source profile and attaches to the target. Returns an empty
 * list — a no-op — for a same-group drop or when the target already holds the
 * competency (dropping onto a profile that already has it must NOT silently
 * strip it from the source). Profiles other than the source and target are
 * never touched, so a competency shared across several profiles keeps its other
 * memberships.
 */
export function reassignCompetency(
  quals: readonly KeyQualification[],
  sourceGroup: string,
  targetGroup: string,
  competencyId: string,
): BundlePatch[] {
  if (!competencyId || sourceGroup === targetGroup) return []
  const target = targetGroup === UNASSIGNED_GROUP ? null : quals.find((q) => q.id === targetGroup) ?? null
  // Already on the target profile → no-op (don't detach from the source).
  if (target && (target.competency_ids ?? []).includes(competencyId)) return []

  const patches: BundlePatch[] = []
  if (sourceGroup !== UNASSIGNED_GROUP) {
    const source = quals.find((q) => q.id === sourceGroup)
    const ids = source?.competency_ids ?? []
    if (source && ids.includes(competencyId)) {
      patches.push({ profileId: source.id, competency_ids: ids.filter((x) => x !== competencyId) })
    }
  }
  if (target) {
    patches.push({ profileId: target.id, competency_ids: [...(target.competency_ids ?? []), competencyId] })
  }
  return patches
}
