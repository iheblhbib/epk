# Workspace Switcher Improvements — Design

## Context

`WorkspaceSwitcher.tsx` is currently a plain dropdown: a flat `<DropdownMenuItem>` per
workspace showing only its name and a checkmark on the current one, plus a
"new workspace" creation dialog. It doesn't use two fields already present on
the `Workspace` type — `logo_url` and `my_role` — and gives no way to search,
leave a workspace, jump to settings, or see pending invitations from here.

Three things worth knowing before the design below:

- **Invitations today are token-only.** `WorkspaceInvitationController` has
  `show`/`accept`/`login`/`register`, all keyed by the 64-char `invite_token`
  emailed to the invitee. There is no endpoint that lists "my pending
  invitations" — a logged-in user has no in-app way to discover an invite
  except by opening the email link. `WorkspaceMemberStatus` has only
  `Pending`/`Active` — no `Declined` state exists.
- **`accept()`'s ownership check is the reusable authorization primitive.**
  `$member->user_id === $user->id || ($member->user_id === null &&
  strcasecmp($member->invited_email, $user->email) === 0)` is exactly the
  rule a new "list mine" / "decline mine" pair needs too — it's extracted
  into a shared private method rather than duplicated.
- **`useLeaveWorkspace()` already exists** (used today by `SettingsPage.tsx`
  for the current workspace only) and **role badges already exist** as a
  rendering pattern (`TeamPage.tsx`: `<Badge variant="secondary"
  className="capitalize">{t('common.roles.'+role)}</Badge>`) — both are
  reused as-is, not rebuilt.
- **`/settings` is not workspace-scoped in the URL** — like every other page
  in this app, it reads `currentWorkspace` from context. A per-row settings
  shortcut for a workspace other than the current one would require
  switching first anyway, so this spec adds one current-workspace-only
  settings link, not a per-row shortcut.

## Goals

- **Visual identity**: each workspace shows its logo, or a deterministic
  colored initial avatar when it has none.
- **Role context**: each workspace row shows the caller's role in it.
- **Search**: a filter input appears once the list is long enough to need
  one.
- **Quick actions**: a settings shortcut for the current workspace, and a
  per-row leave-workspace action.
- **Pending invites**: a section in the same dropdown listing workspaces the
  user has been invited to but not yet joined, with inline Accept/Decline.

## Non-goals (explicitly out of scope for this pass)

- **No `Declined` status or decline history.** Declining deletes the pending
  `workspace_members` row — functionally identical to the invite never having
  been sent. An admin can simply re-invite the same email later.
- **No per-row settings shortcut.** Only the current workspace's settings are
  linked, for the URL-scoping reason above.
- **No pagination or virtualization of the workspace list.** Client-side
  substring filtering is sufficient at this app's scale (the full list is
  already fetched today with no pagination).
- **No real-time/push update when a new invite arrives.** The pending-invites
  list refreshes on the same mount/window-focus cadence as every other
  TanStack Query data in this app — no websocket/polling added.
- **No changes to how invitations are created or emailed** — `WorkspaceMemberController`'s
  invite flow and `WorkspaceInvitationNotification` are untouched.

## Backend changes

### `app/Http/Controllers/Api/WorkspaceInvitationController.php`

Two new public methods, plus one new private helper extracted from the
existing `accept()` so the ownership rule lives in exactly one place:

```php
/**
 * Pending invitations addressed to the authenticated user's email --
 * the in-app counterpart to the emailed token link, for a user who's
 * already logged in and browsing the workspace switcher. Matched by
 * email (case-insensitively, same as accept()/login()), not by any
 * stored user_id, since a pending invite is-by-definition not yet
 * linked to an account.
 */
public function index(Request $request): JsonResponse
{
    $email = $request->user()->email;

    $invitations = WorkspaceMember::where('status', WorkspaceMemberStatus::Pending)
        ->whereNull('user_id')
        ->whereRaw('lower(invited_email) = ?', [strtolower($email)])
        ->with(['workspace:id,name', 'inviter:id,name'])
        ->latest()
        ->get()
        ->map(fn (WorkspaceMember $member) => [
            'token' => $member->invite_token,
            'workspace' => ['id' => $member->workspace->id, 'name' => $member->workspace->name],
            'role' => $member->role,
            'invited_by' => $member->inviter?->name,
            'created_at' => $member->created_at,
        ]);

    return response()->json(['data' => $invitations]);
}

/**
 * Decline an invitation addressed to you. There's no "declined" status
 * in WorkspaceMemberStatus -- deleting the pending row is functionally
 * identical to the invite never having existed, and avoids adding a
 * status value only this one action would ever set.
 */
public function decline(Request $request, string $token): JsonResponse
{
    $member = $this->resolvePending($token);

    $this->authorizeOwnership($member, $request->user());

    $member->delete();

    return response()->json(null, 204);
}

/**
 * The rule accept()/login() already apply inline -- extracted so index()
 * and decline() share the exact same check rather than re-deriving it.
 */
private function authorizeOwnership(WorkspaceMember $member, User $user): void
{
    $ownsInvite = $member->user_id === $user->id
        || ($member->user_id === null && strcasecmp((string) $member->invited_email, $user->email) === 0);

    if (! $ownsInvite) {
        throw ValidationException::withMessages([
            'token' => __('This invitation was not addressed to your account.'),
        ]);
    }
}
```

`accept()`'s existing inline check is replaced with a call to
`$this->authorizeOwnership($member, $user);` — same behavior, now shared.

### `routes/api.php`

Two new routes inside the existing authenticated group (near the current
`/invitations/{token}/accept` route):

```php
Route::get('/invitations', [WorkspaceInvitationController::class, 'index']);
Route::delete('/invitations/{token}', [WorkspaceInvitationController::class, 'decline']);
```

The existing public `GET /invitations/{token}` (`show`) is untouched — a
`GET` on the collection path (`/invitations`) and a `GET` on a member path
(`/invitations/{token}`) don't conflict.

## Frontend changes

### `frontend/src/components/layout/WorkspaceAvatar.tsx` (new)

```tsx
const PALETTE = ['#cc1417', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export function WorkspaceAvatar({ id, name, logoUrl }: { id: number; name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className="size-6 shrink-0 rounded-md object-cover" />
  }

  const color = PALETTE[id % PALETTE.length]

  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
```

(Keyed by `id % PALETTE.length`, not a name hash — stable across a rename,
unlike a hash of the mutable `name` field.)

### `frontend/src/api/workspaces.ts` — two new functions

```typescript
export interface PendingInvitation {
  token: string
  workspace: { id: number; name: string }
  role: WorkspaceRole
  invited_by: string | null
  created_at: string
}

export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const { data } = await apiClient.get<ApiResource<PendingInvitation[]>>('/api/invitations')
  return data.data
}

export async function declineInvitation(token: string): Promise<void> {
  await apiClient.delete(`/api/invitations/${token}`)
}
```

### `frontend/src/features/workspaces/hooks/useWorkspaces.ts` — two new hooks

```typescript
export function usePendingInvitations() {
  return useQuery({ queryKey: ['invitations', 'pending'], queryFn: listPendingInvitations })
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => declineInvitation(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', 'pending'] }),
  })
}
```

`useAcceptInvitation()` (already exists) additionally needs, at its existing
call site in the switcher (not changing the hook itself, just how the
switcher uses it): on success, invalidate `['invitations', 'pending']` in
addition to whatever it already invalidates, so the accepted invite
disappears from the list immediately.

### `WorkspaceSwitcher.tsx` — rewritten dropdown body

Structure, top to bottom inside `<DropdownMenuContent>`:

1. **Pending invites group** (rendered only when `invitations.length > 0`):
   one row per invitation — `<WorkspaceAvatar id={invitation.workspace.id}
   name={invitation.workspace.name} logoUrl={null} />` (always the initial
   fallback, since `PendingInvitation`'s workspace payload carries no
   `logo_url`), text `t('workspaces.invitations.invitedBy', { name: invitation.invited_by
   ?? t('notifications.someone'), workspace: invitation.workspace.name, role:
   t('common.roles.'+invitation.role) })`, then two small buttons: Accept
   (calls `useAcceptInvitation().mutate(invitation.token)`) and Decline
   (calls `useDeclineInvitation().mutate(invitation.token)`), each disabled
   while its own mutation is pending. A `<DropdownMenuSeparator />` follows
   this group only when it rendered.
2. **Search input** (rendered only when `workspaces.length > 5`): a
   controlled `<Input>` (local `useState`, not persisted) filtering the
   workspace list below by case-insensitive substring match on `name`.
3. **Workspace list**: each `<DropdownMenuItem>` gains `<WorkspaceAvatar
   id={workspace.id} name={workspace.name} logoUrl={workspace.logo_url} />`
   before the name, and `<Badge variant="secondary" className="ml-auto
   capitalize">{t('common.roles.'+workspace.my_role)}</Badge>` plus a small
   leave icon-button after the existing checkmark. The leave button opens a
   `ConfirmDialog` (this app's existing shared confirm-dialog component,
   used elsewhere for destructive actions); on confirm, calls
   `useLeaveWorkspace().mutate(workspace.id)`. A failure (e.g. sole owner)
   surfaces via the existing toast-on-error pattern this app already uses
   for mutations — no new client-side "is this the last owner" check.
4. **Existing "New workspace" item**, unchanged.
5. **New "Workspace settings" item** at the very bottom, a plain link
   (`<Link to="/settings">`) — current workspace only, per the Context note
   above.

### i18n

New keys in all 7 locales: `workspaces.invitations.{invitedBy, accept,
decline}`; `workspaces.search.placeholder`; `workspaces.leave.{confirmTitle,
confirmDescription, action}`; `workspaces.settingsLink`.

## Testing plan

**Backend (Pest)** — extends `tests/Feature/Workspace/WorkspaceMemberTest.php`
(confirmed: this file already covers the invitation accept/login/register
flows, so new invitation-related tests join it rather than starting a new
file):

- `index` returns only pending, unlinked (`user_id` null) invitations whose
  `invited_email` matches the authenticated user's email case-insensitively;
  excludes another user's invitations; excludes an already-`Active` member
  row even if it shares the same email (a past invite that was accepted).
- `decline` deletes the row and returns 204; a mismatched email gets the
  same 422 `ValidationException` shape `accept()` already returns for that
  case; the token is unusable afterward (a second `accept()` call on the
  same token now 422s with "invalid or has already been used", the existing
  `resolvePending()` behavior for a missing row).
- `accept()` still behaves identically after the ownership-check extraction
  (a regression check on the refactor, not new behavior).

**Frontend (Vitest + RTL)**:

- `WorkspaceAvatar.test.tsx`: renders an `<img>` when `logoUrl` is set;
  renders the first letter, uppercased, when it isn't; the same `id` always
  produces the same background color across renders.
- `WorkspaceSwitcher.test.tsx` (new — none exists today): role badge renders
  per workspace; search input is absent at 5 workspaces and present at 6,
  and filters the list; pending-invites group is absent when the mocked
  endpoint returns `[]` and renders a row with working Accept/Decline when it
  doesn't (mocked via MSW); leave-workspace opens the confirm dialog and
  calls the mutation on confirm; the settings link points at `/settings`.

## Open items for the implementation plan

- Final i18n strings for all new keys, in all 7 locales.
- Exact spacing/layout of the per-row role badge + leave button within the
  existing `<DropdownMenuItem>` (a small layout call, not architectural).
