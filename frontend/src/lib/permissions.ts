import type { WorkspaceRole } from '@/types'

// Mirrors the exact role checks in the backend's
// InteractsWithWorkspaceMembership trait (isEditorLevel/isAdminLevel) — kept
// here as the single frontend source of truth for hiding actions a role
// can't perform, so a viewer/editor never sees a button that would just
// 403 if clicked. This is a UX nicety only: every one of these abilities is
// still enforced server-side by the matching Policy regardless of what the
// frontend does or doesn't render.

const EDITOR_LEVEL_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor']
const ADMIN_LEVEL_ROLES: WorkspaceRole[] = ['owner', 'admin']

/** Can create/update EPKs, artists, media, contacts, and private links. */
export function isEditorLevel(role: WorkspaceRole | null | undefined): boolean {
  return !!role && EDITOR_LEVEL_ROLES.includes(role)
}

/** Can additionally delete EPKs/artists, manage workspace settings, and invite/manage members. */
export function isAdminLevel(role: WorkspaceRole | null | undefined): boolean {
  return !!role && ADMIN_LEVEL_ROLES.includes(role)
}

/** Can delete the workspace itself. */
export function isOwner(role: WorkspaceRole | null | undefined): boolean {
  return role === 'owner'
}
