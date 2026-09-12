# Workspace Switcher Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Workspace Switcher dropdown with logo/initial avatars, role badges, a search filter, a per-row leave action, a current-workspace settings shortcut, and an inline pending-invitations section with Accept/Decline.

**Architecture:** One small backend addition (list + decline endpoints on the existing `WorkspaceInvitationController`, reusing its existing accept-flow authorization) plus a frontend-only rewrite of `WorkspaceSwitcher.tsx` and one new small `WorkspaceAvatar` component.

**Tech Stack:** Laravel 12 + Pest (backend), React + TypeScript + TanStack Query + Base UI (`@base-ui/react/menu`) + Vitest/RTL (frontend).

**Spec:** [docs/superpowers/specs/2026-09-12-workspace-switcher-improvements-design.md](../specs/2026-09-12-workspace-switcher-improvements-design.md)

## Global Constraints

- No new `WorkspaceMemberStatus` value. Declining an invitation deletes the pending `workspace_members` row.
- No per-row settings shortcut — only one "Workspace settings" link for the *current* workspace (`/settings` is not workspace-scoped in the URL).
- No pagination/virtualization of the workspace list; the search box only filters the already-fetched list, and only renders once `workspaces.length > 5`.
- No real-time/push updates for new invites — the pending-invites list refreshes on the same mount/window-focus cadence as every other TanStack Query in this app.
- **Base UI Menu interaction rule (verified by reading `@base-ui/react`'s own source, not assumed):** `DropdownMenuItem` is Base UI's `Menu.Item`. Its close-on-click behavior fires from a plain React `onClick` handler on the item's own root element (`useMenuItemCommonProps.js`: `onClick(event) { if (closeOnClick) { menuEvents.emit('close', ...) } }`). This means a nested `<button>` inside a `DropdownMenuItem` (the per-row Leave button) **must** call `event.stopPropagation()` in its own `onClick` before doing anything else — otherwise the click bubbles to the Item's handler, which both closes the dropdown *and* fires the Item's own `onClick` (switching to that workspace, which is not what a Leave click means). Because stopping propagation also prevents the Item's own close-on-click from firing, the switcher's `<DropdownMenu>` must be **controlled** (`open`/`onOpenChange` state) so the Leave button can close the dropdown itself, matching the existing "click New workspace → dropdown closes → dialog opens" pattern already used lower in this same file.
- Pending-invite rows are **not** `DropdownMenuItem`s at all (there is no "switch to it" action for a workspace you haven't joined yet) — they're plain `<div>` rows with two independent buttons, which sidesteps the nested-interactive-item problem entirely for that section.
- Reuse existing patterns exactly: role badges (`<Badge variant="secondary" className="capitalize">{t('common.roles.'+role)}</Badge>`, from `TeamPage.tsx`), search input markup (`Search` icon absolutely positioned inside a `relative` wrapper, `<Input className="ps-8">`, from `ContactsPage.tsx`), and navigation from a dropdown item (`<DropdownMenuItem onClick={() => navigate('/settings')}>` with `useNavigate()`, from `Topbar.tsx`).

---

### Task 1: Backend — list and decline pending invitations

**Files:**
- Modify: `backend/app/Http/Controllers/Api/WorkspaceInvitationController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Workspace/WorkspaceMemberTest.php`

**Interfaces:**
- Produces: `GET /api/invitations` → `{data: [{token, workspace: {id, name}, role, invited_by, created_at}]}`; `DELETE /api/invitations/{token}` → `204` on success, `422` (same shape as `accept()`'s existing error) when the token isn't addressed to the authenticated user.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/Feature/Workspace/WorkspaceMemberTest.php` (append at the end of the file — it already has `makeWorkspaceWithOwner()` defined at the top, reused here):

```php
it('lists pending invitations addressed to the authenticated users email', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $response = $this->actingAs($invitee)->getJson('/api/invitations');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    $response->assertJsonPath('data.0.workspace.name', $workspace->name)
        ->assertJsonPath('data.0.role', WorkspaceRole::Editor->value)
        ->assertJsonPath('data.0.invited_by', $owner->name);
});

it('does not list another users pending invitations', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $stranger = User::factory()->create(['email' => 'stranger@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $response = $this->actingAs($stranger)->getJson('/api/invitations');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(0);
});

it('matches pending invitations to the authenticated users email case-insensitively', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'Invitee@Example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ]);

    $response = $this->actingAs($invitee)->getJson('/api/invitations');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
});

it('excludes an already-accepted invitation from the pending list', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;
    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertOk();

    $response = $this->actingAs($invitee)->getJson('/api/invitations');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(0);
});

it('lets an invitee decline their invitation, deleting it', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $member = $workspace->members()->where('user_id', $invitee->id)->first();
    $token = $member->invite_token;

    $this->actingAs($invitee)->deleteJson("/api/invitations/{$token}")->assertNoContent();

    $this->assertDatabaseMissing('workspace_members', ['id' => $member->id]);
});

it('rejects declining an invitation addressed to someone else', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);
    $stranger = User::factory()->create();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;

    $this->actingAs($stranger)->deleteJson("/api/invitations/{$token}")->assertUnprocessable();
    $this->assertDatabaseHas('workspace_members', ['invite_token' => $token]);
});

it('makes a declined invitation token unusable afterward', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;
    $this->actingAs($invitee)->deleteJson("/api/invitations/{$token}")->assertNoContent();

    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertUnprocessable();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `php artisan test --filter=WorkspaceMemberTest`
Expected: FAIL — `/api/invitations` and the `DELETE /api/invitations/{token}` route don't exist yet (404s).

- [ ] **Step 3: Add the routes**

In `backend/routes/api.php`, near the existing `Route::post('/invitations/{token}/accept', ...)` line, add:

```php
Route::get('/invitations', [WorkspaceInvitationController::class, 'index']);
Route::delete('/invitations/{token}', [WorkspaceInvitationController::class, 'decline']);
```

(Both inside the same authenticated middleware group the existing `accept`/`login`/`register` routes are already in.)

- [ ] **Step 4: Extract the shared ownership check and add the two new controller methods**

In `backend/app/Http/Controllers/Api/WorkspaceInvitationController.php`:

Replace the inline ownership check inside `accept()`:

```php
        $user = $request->user();
        $ownsInvite = $member->user_id === $user->id
            || ($member->user_id === null && strcasecmp((string) $member->invited_email, $user->email) === 0);

        if (! $ownsInvite) {
            throw ValidationException::withMessages([
                'token' => __('This invitation was not addressed to your account.'),
            ]);
        }
```

with:

```php
        $user = $request->user();
        $this->authorizeOwnership($member, $user);
```

Add these two new public methods (anywhere in the class — placed here right after `show()` for readability) and the new private helper (placed right after `resolvePending()`):

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
```

```php
    /**
     * The rule accept() already applied inline -- extracted so index() and
     * decline() share the exact same check rather than re-deriving it.
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `php artisan test --filter=WorkspaceMemberTest`
Expected: PASS (all tests in the file, including the pre-existing ones — this confirms the `accept()` refactor didn't change its behavior).

- [ ] **Step 6: Run the full backend suite and Pint**

Run: `php artisan test` and `vendor/bin/pint --test app/ tests/`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/WorkspaceInvitationController.php backend/routes/api.php backend/tests/Feature/Workspace/WorkspaceMemberTest.php
git commit -m "feat: list and decline pending workspace invitations"
```

---

### Task 2: Frontend — API functions and hooks for pending invitations

**Files:**
- Modify: `frontend/src/api/workspaces.ts`
- Modify: `frontend/src/features/workspaces/hooks/useWorkspaces.ts`
- Test: `frontend/src/features/workspaces/hooks/useWorkspaces.test.ts` (new — none exists today)

**Interfaces:**
- Consumes: `apiClient` from `@/api/client` (already used by every function in `workspaces.ts`).
- Produces: `export interface PendingInvitation { token: string; workspace: { id: number; name: string }; role: WorkspaceRole; invited_by: string | null; created_at: string }`, `listPendingInvitations(): Promise<PendingInvitation[]>`, `declineInvitation(token: string): Promise<void>`, `usePendingInvitations()`, `useDeclineInvitation()`. Task 4 (`WorkspaceSwitcher.tsx`) consumes all four, plus the existing `useAcceptInvitation()`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/workspaces/hooks/useWorkspaces.test.ts`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { useDeclineInvitation, usePendingInvitations } from '@/features/workspaces/hooks/useWorkspaces'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('usePendingInvitations', () => {
  it('fetches the list of pending invitations', async () => {
    server.use(
      http.get(`${API_URL}/api/invitations`, () =>
        HttpResponse.json({
          data: [
            { token: 'abc123', workspace: { id: 1, name: 'Acme Records' }, role: 'editor', invited_by: 'Ada Lovelace', created_at: '2026-09-01T00:00:00.000000Z' },
          ],
        })
      )
    )

    const { result } = renderHook(() => usePendingInvitations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].workspace.name).toBe('Acme Records')
  })
})

describe('useDeclineInvitation', () => {
  it('calls the decline endpoint with the token', async () => {
    server.use(http.delete(`${API_URL}/api/invitations/abc123`, () => new HttpResponse(null, { status: 204 })))

    const { result } = renderHook(() => useDeclineInvitation(), { wrapper })

    result.current.mutate('abc123')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx vitest run src/features/workspaces/hooks/useWorkspaces.test.ts`
Expected: FAIL — `usePendingInvitations`/`useDeclineInvitation` are not exported yet.

- [ ] **Step 3: Add the API functions**

In `frontend/src/api/workspaces.ts`, add (near the existing `acceptInvitation`/`previewInvitation` functions):

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

(`WorkspaceRole` and `ApiResource` are already imported at the top of this file for the other exports — no new imports needed.)

- [ ] **Step 4: Add the hooks and update `useAcceptInvitation`**

In `frontend/src/features/workspaces/hooks/useWorkspaces.ts`:

Add `listPendingInvitations` and `declineInvitation` to the existing import from `@/api/workspaces`, then add:

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

Update the existing `useAcceptInvitation` so accepting also refreshes the pending list (find its current body and add the new invalidation alongside whatever it already does):

```typescript
export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', 'pending'] })
      queryClient.invalidateQueries({ queryKey: workspacesKey })
    },
  })
}
```

(`workspacesKey` is already defined and used elsewhere in this same file — reuse it, don't redefine it. If the existing `useAcceptInvitation` body already invalidates something else, keep that too; the two lines above are additive, not a full replacement, if there's pre-existing logic to preserve.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/workspaces/hooks/useWorkspaces.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full frontend test suite**

Run: `npx vitest run`
Expected: PASS — confirms the `useAcceptInvitation` change didn't break `AcceptInvitationPage`'s existing usage.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/workspaces.ts frontend/src/features/workspaces/hooks/useWorkspaces.ts frontend/src/features/workspaces/hooks/useWorkspaces.test.ts
git commit -m "feat: add API/hooks for listing and declining pending invitations"
```

---

### Task 3: Frontend — `WorkspaceAvatar` component

**Files:**
- Create: `frontend/src/components/layout/WorkspaceAvatar.tsx`
- Test: `frontend/src/components/layout/WorkspaceAvatar.test.tsx`

**Interfaces:**
- Produces: `export function WorkspaceAvatar({ id, name, logoUrl }: { id: number; name: string; logoUrl: string | null })`. Task 4 uses this for each workspace row (with its real `logo_url`) and each pending-invite row (with `logoUrl={null}`, since `PendingInvitation.workspace` carries no logo field).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/WorkspaceAvatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceAvatar } from '@/components/layout/WorkspaceAvatar'

describe('WorkspaceAvatar', () => {
  it('renders an image when logoUrl is set', () => {
    render(<WorkspaceAvatar id={1} name="Acme Records" logoUrl="https://example.com/logo.png" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  it('renders the uppercased first letter when logoUrl is null', () => {
    render(<WorkspaceAvatar id={1} name="acme records" logoUrl={null} />)

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('gives the same id the same background color across renders', () => {
    const { container: first } = render(<WorkspaceAvatar id={3} name="Acme" logoUrl={null} />)
    const { container: second } = render(<WorkspaceAvatar id={3} name="Different Name" logoUrl={null} />)

    const firstColor = (first.querySelector('span') as HTMLElement).style.backgroundColor
    const secondColor = (second.querySelector('span') as HTMLElement).style.backgroundColor
    expect(firstColor).toBe(secondColor)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/WorkspaceAvatar.test.tsx`
Expected: FAIL — `Cannot find module '@/components/layout/WorkspaceAvatar'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/layout/WorkspaceAvatar.tsx`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/WorkspaceAvatar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/WorkspaceAvatar.tsx frontend/src/components/layout/WorkspaceAvatar.test.tsx
git commit -m "feat: add WorkspaceAvatar (logo or colored initial fallback)"
```

---

### Task 4: Frontend — rewrite `WorkspaceSwitcher.tsx`

**Files:**
- Modify: `frontend/src/components/layout/WorkspaceSwitcher.tsx`
- Test: `frontend/src/components/layout/WorkspaceSwitcher.test.tsx` (new — none exists today)
- Modify: `frontend/src/i18n/locales/en.json` (and the other 6 locale files, Step 6 below)

**Interfaces:**
- Consumes: `WorkspaceAvatar` (Task 3); `usePendingInvitations`, `useDeclineInvitation`, `useAcceptInvitation` (Task 2, `useAcceptInvitation` pre-existing); `useLeaveWorkspace` (pre-existing, `frontend/src/features/workspaces/hooks/useWorkspaces.ts`); `ConfirmDialog` (pre-existing, `@/components/common/ConfirmDialog`); `useNavigate` from `react-router-dom`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/WorkspaceSwitcher.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

const workspaces = [
  { id: 1, name: 'Acme Records', slug: 'acme', description: null, logo_url: null, my_role: 'owner', members_count: 3, created_at: '', updated_at: '' },
  { id: 2, name: 'Beta Label', slug: 'beta', description: null, logo_url: null, my_role: 'editor', members_count: 2, created_at: '', updated_at: '' },
]

function mockBaseline(overrides: { invitations?: unknown[] } = {}) {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: workspaces })),
    http.get(`${API_URL}/api/invitations`, () => HttpResponse.json({ data: overrides.invitations ?? [] }))
  )
}

function renderSwitcher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkspaceSwitcher />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('WorkspaceSwitcher', () => {
  it('shows a role badge for each workspace', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(await screen.findByText('Owner')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('does not show a search input at 2 workspaces', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
  })

  it('shows and filters a search input at more than 5 workspaces', async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `Workspace ${i + 1}`,
      slug: `ws-${i + 1}`,
      description: null,
      logo_url: null,
      my_role: 'owner',
      members_count: 1,
      created_at: '',
      updated_at: '',
    }))
    server.use(
      http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: many })),
      http.get(`${API_URL}/api/invitations`, () => HttpResponse.json({ data: [] }))
    )
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /workspace 1/i }))
    const search = await screen.findByPlaceholderText(/search/i)

    await user.type(search, 'Workspace 3')

    expect(screen.getByText('Workspace 3')).toBeInTheDocument()
    expect(screen.queryByText('Workspace 1')).not.toBeInTheDocument()
  })

  it('shows a pending invitation with working accept and decline', async () => {
    mockBaseline({
      invitations: [
        { token: 'tok-1', workspace: { id: 9, name: 'Gamma Studio' }, role: 'viewer', invited_by: 'Ada Lovelace', created_at: '2026-09-01T00:00:00.000000Z' },
      ],
    })
    let declineCalled = false
    server.use(
      http.delete(`${API_URL}/api/invitations/tok-1`, () => {
        declineCalled = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(await screen.findByText(/Gamma Studio/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /decline/i }))

    await waitFor(() => expect(declineCalled).toBe(true))
  })

  it('renders no pending-invitations section when there are none', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))

    expect(screen.queryByText(/invited/i)).not.toBeInTheDocument()
  })

  it('opens a confirm dialog for leave-workspace without switching or closing the dropdown menu item', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))
    await user.click(screen.getAllByRole('button', { name: /leave/i })[1]) // Beta Label's leave button

    expect(await screen.findByText(/leave.*beta label/i)).toBeInTheDocument()
  })

  it('navigates to /settings when the settings item is clicked', async () => {
    mockBaseline()
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(await screen.findByRole('button', { name: /acme records/i }))
    await user.click(await screen.findByRole('menuitem', { name: /settings/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })
})
```

(`MemoryRouter` is still needed in `renderSwitcher()` for the rest of the component tree to render without a router-context error, even with `useNavigate` mocked.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/WorkspaceSwitcher.test.tsx`
Expected: FAIL — the current component has no role badges, no search, no pending-invites section, no leave button, no settings item.

- [ ] **Step 3: Rewrite the component**

Replace the full contents of `frontend/src/components/layout/WorkspaceSwitcher.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronsUpDown, Loader2, LogOut, Plus, Search, Settings } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { WorkspaceAvatar } from '@/components/layout/WorkspaceAvatar'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import {
  useAcceptInvitation,
  useCreateWorkspace,
  useDeclineInvitation,
  useLeaveWorkspace,
  usePendingInvitations,
} from '@/features/workspaces/hooks/useWorkspaces'
import type { Workspace } from '@/types'

function createWorkspaceSchema(t: TFunction) {
  return z.object({
    name: z.string().min(1, t('workspaces.create.nameRequired')).max(255),
  })
}

type CreateWorkspaceValues = z.infer<ReturnType<typeof createWorkspaceSchema>>

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useCurrentWorkspace()
  const { data: invitations } = usePendingInvitations()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [leaveTarget, setLeaveTarget] = useState<Workspace | null>(null)
  const createWorkspace = useCreateWorkspace()
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()
  const leaveWorkspace = useLeaveWorkspace()

  const form = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema(t)),
    defaultValues: { name: '' },
  })

  const onSubmit = form.handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onSuccess: (workspace) => {
        toast.success(t('workspaces.create.created'))
        setCurrentWorkspaceId(workspace.id)
        setCreateOpen(false)
        form.reset()
      },
      onError: () => toast.error(t('workspaces.create.error')),
    })
  })

  const visibleWorkspaces = search.trim()
    ? workspaces.filter((workspace) => workspace.name.toLowerCase().includes(search.trim().toLowerCase()))
    : workspaces

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-between font-normal sm:w-56"
            />
          }
        >
          <span className="truncate">{currentWorkspace?.name ?? t('workspaces.selectWorkspace')}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          {invitations && invitations.length > 0 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('workspaces.invitations.title')}</DropdownMenuLabel>
                {invitations.map((invitation) => (
                  <div key={invitation.token} className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm">
                    <WorkspaceAvatar id={invitation.workspace.id} name={invitation.workspace.name} logoUrl={null} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate">
                        {t('workspaces.invitations.invitedBy', {
                          name: invitation.invited_by ?? t('notifications.someone'),
                          workspace: invitation.workspace.name,
                          role: t(`common.roles.${invitation.role}`),
                        })}
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={acceptInvitation.isPending}
                          onClick={() =>
                            acceptInvitation.mutate(invitation.token, {
                              onSuccess: () => {
                                toast.success(t('workspaces.invitations.accepted'))
                                setCurrentWorkspaceId(invitation.workspace.id)
                              },
                              onError: () => toast.error(t('workspaces.invitations.acceptError')),
                            })
                          }
                        >
                          {t('workspaces.invitations.accept')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={declineInvitation.isPending}
                          onClick={() =>
                            declineInvitation.mutate(invitation.token, {
                              onError: () => toast.error(t('workspaces.invitations.declineError')),
                            })
                          }
                        >
                          {t('workspaces.invitations.decline')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          {workspaces.length > 5 && (
            <div className="relative px-1.5 pb-1.5">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('workspaces.search.placeholder')}
                className="h-8 ps-7 text-sm"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          )}

          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('workspaces.label')}</DropdownMenuLabel>
            {visibleWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setCurrentWorkspaceId(workspace.id)}
              >
                <WorkspaceAvatar id={workspace.id} name={workspace.name} logoUrl={workspace.logo_url} />
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.my_role && (
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {t(`common.roles.${workspace.my_role}`)}
                  </Badge>
                )}
                {workspace.id === currentWorkspace?.id && <Check className="size-4 shrink-0" />}
                <button
                  type="button"
                  aria-label={t('workspaces.leave.action')}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpen(false)
                    setLeaveTarget(workspace)
                  }}
                >
                  <LogOut className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('workspaces.newWorkspace')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="size-4" />
            {t('workspaces.settingsLink')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workspaces.create.title')}</DialogTitle>
            <DialogDescription>{t('workspaces.create.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workspaces.create.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Records" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createWorkspace.isPending}>
                  {createWorkspace.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('workspaces.create.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={leaveTarget !== null}
        onOpenChange={(next) => {
          if (!next) setLeaveTarget(null)
        }}
        title={t('workspaces.leave.confirmTitle')}
        description={leaveTarget ? t('workspaces.leave.confirmDescription', { workspace: leaveTarget.name }) : undefined}
        destructive
        isLoading={leaveWorkspace.isPending}
        confirmLabel={t('workspaces.leave.action')}
        onConfirm={() => {
          if (!leaveTarget) return
          leaveWorkspace.mutate(leaveTarget.id, {
            onSuccess: () => {
              toast.success(t('workspaces.leave.success', { workspace: leaveTarget.name }))
              setLeaveTarget(null)
            },
            onError: () => toast.error(t('workspaces.leave.error')),
          })
        }}
      />
    </>
  )
}
```

`acceptInvitation`'s `onSuccess` above sets the current workspace directly from `invitation.workspace.id` (the invitation object already carried this before the mutation ran), rather than reading anything off the mutation's resolved value — simpler and avoids depending on the exact shape `acceptInvitation()` in `api/workspaces.ts` resolves to.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/WorkspaceSwitcher.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full frontend verification suite**

Run (from `frontend/`): `npx vitest run`, `npx tsc -b --noEmit`, `npx oxlint`
Expected: all clean.

- [ ] **Step 6: Add the new i18n keys to all 7 locales**

Add to `frontend/src/i18n/locales/en.json` under the existing `workspaces` key (alongside `label`, `selectWorkspace`, `newWorkspace`, `create`):

```json
"invitations": {
  "title": "Pending invites",
  "invitedBy": "{{name}} invited you to {{workspace}} as {{role}}",
  "accept": "Accept",
  "decline": "Decline",
  "accepted": "Invitation accepted",
  "acceptError": "Couldn't accept the invitation. Try again.",
  "declineError": "Couldn't decline the invitation. Try again."
},
"search": {
  "placeholder": "Search workspaces..."
},
"leave": {
  "confirmTitle": "Leave workspace?",
  "confirmDescription": "You'll lose access to {{workspace}} until someone invites you back.",
  "action": "Leave",
  "success": "You left {{workspace}}",
  "error": "Couldn't leave the workspace. Try again."
},
"settingsLink": "Workspace settings"
```

Translate the same keys into `fr.json`, `es.json`, `pt.json`, `de.json`, `ar.json`, `zh.json`, following each file's existing hand-formatted style (CRLF line endings, not prettier-run) — edit each via a targeted Node script doing a string replace anchored on a unique surrounding string in that file (never `JSON.stringify` the whole file, which destroys the existing formatting), and validate every file with `JSON.parse` after editing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/WorkspaceSwitcher.tsx frontend/src/components/layout/WorkspaceSwitcher.test.tsx frontend/src/i18n/locales/*.json
git commit -m "feat: add avatars, role badges, search, leave, settings link, and pending invites to the Workspace Switcher"
```

---

## Post-plan mirror step (not a task — part of this project's standing workflow)

After all 4 tasks are complete and reviewed: run `npm run build` in `frontend/` to refresh the committed `dist/` bundle, commit that rebuild, then copy the changed backend files into `epk-back` and the changed frontend files (+ refreshed `dist/`) into `epk-front`, committing each with a message describing the feature. Do not push any repo until the user explicitly says so.
