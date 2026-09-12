<?php

namespace App\Http\Controllers\Api;

use App\Enums\Locale;
use App\Enums\UserRole;
use App\Enums\WorkspaceMemberStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceMemberResource;
use App\Models\User;
use App\Models\WorkspaceMember;
use App\Notifications\InvitationAcceptedNotification;
use App\Notifications\TeamMemberJoinedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class WorkspaceInvitationController extends Controller
{
    /**
     * Preview a pending invitation before it's accepted — lets the frontend
     * show "You've been invited to join {workspace} as {role}" instead of
     * blind-accepting the moment the link is opened. Deliberately public
     * (no auth required): the token itself — 64 random chars, emailed only
     * to the invitee — is already the access control, the same way a
     * Slack/Notion-style invite link works. This is what lets the frontend
     * offer "create a password" or "log in" right on this page instead of
     * bouncing an unauthenticated visitor through a separate /login or
     * /register page and back.
     */
    public function show(string $token): JsonResponse
    {
        $member = $this->resolvePending($token);

        return response()->json([
            'data' => [
                'workspace' => ['id' => $member->workspace->id, 'name' => $member->workspace->name],
                'role' => $member->role,
                'invited_by' => $member->inviter?->name,
                'invited_email' => $member->invited_email,
                'has_account' => $member->user_id !== null
                    || User::whereRaw('lower(email) = ?', [strtolower((string) $member->invited_email)])->exists(),
            ],
        ]);
    }

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
        $user = $request->user();

        // Mirrors authorizeOwnership()'s two cases: an invite to an
        // already-registered email has user_id set immediately by
        // WorkspaceMemberController::store() even while still Pending, while
        // an invite to a not-yet-registered email leaves user_id null until
        // accepted -- both are "pending invitations belonging to this user".
        $invitations = WorkspaceMember::where('status', WorkspaceMemberStatus::Pending)
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere(function ($query) use ($user) {
                        $query->whereNull('user_id')
                            ->whereRaw('lower(invited_email) = ?', [strtolower($user->email)]);
                    });
            })
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
     * Accept as the currently authenticated user — the path for someone
     * who already had a session (or just logged into an existing account
     * from this same page).
     */
    public function accept(Request $request, string $token): JsonResponse
    {
        $member = $this->resolvePending($token);

        $user = $request->user();
        $this->authorizeOwnership($member, $user);

        $this->activate($member, $user->id);

        return (new WorkspaceMemberResource($member->load(['user', 'inviter'])))->response();
    }

    /**
     * Log in as the account this invite was addressed to and accept it in
     * one step — the path for someone whose email already has an account,
     * so they never have to leave this page either. Deliberately one
     * atomic request rather than the frontend chaining a login call into a
     * separate accept call: two client-side mutations racing against the
     * auth-state re-render they themselves trigger is exactly the kind of
     * thing that intermittently leaves the accept call orphaned by an
     * unmount. The email comes from the invite record, never client input.
     */
    public function login(Request $request, string $token): JsonResponse
    {
        $member = $this->resolvePending($token);

        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $email = (string) $member->invited_email;
        $user = User::whereRaw('lower(email) = ?', [strtolower($email)])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => __('auth.failed'),
            ]);
        }

        if ($user->suspended_at !== null) {
            throw ValidationException::withMessages([
                'password' => __('This account has been suspended. Contact support for help.'),
            ]);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        $this->activate($member, $user->id);

        return (new WorkspaceMemberResource($member->load(['user', 'inviter'])))->response();
    }

    /**
     * Create the account this invite was addressed to and accept it in one
     * step — the path for someone with no account yet, so they never have
     * to leave this page. The email comes from the invite record itself,
     * never client input, so there's no way to register under a different
     * address than the one actually invited. email_verified_at is set
     * immediately: clicking a link that only ever reached this address via
     * email is itself proof of controlling it — a second, separate
     * verification email would just repeat a check already satisfied.
     */
    public function register(Request $request, string $token): JsonResponse
    {
        $member = $this->resolvePending($token);

        if ($member->user_id !== null) {
            throw ValidationException::withMessages([
                'token' => __('This invitation is already linked to an account — log in instead.'),
            ]);
        }

        $email = (string) $member->invited_email;

        if (User::whereRaw('lower(email) = ?', [strtolower($email)])->exists()) {
            throw ValidationException::withMessages([
                'token' => __('An account already exists for this email — log in instead.'),
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $email,
            'password' => Hash::make($validated['password']),
            'role' => UserRole::User,
            'locale' => Locale::from(app()->getLocale()),
        ]);
        // Not mass-assignable (email_verified_at isn't in $fillable, by
        // design — the same reason admin suspension sets suspended_at via a
        // direct property, not create()), so set and save it explicitly.
        $user->forceFill(['email_verified_at' => now()])->save();

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        $this->activate($member, $user->id);

        return (new WorkspaceMemberResource($member->load(['user', 'inviter'])))->response()->setStatusCode(201);
    }

    private function resolvePending(string $token): WorkspaceMember
    {
        $member = WorkspaceMember::where('invite_token', $token)
            ->where('status', WorkspaceMemberStatus::Pending)
            ->with(['workspace', 'inviter'])
            ->first();

        if (! $member) {
            throw ValidationException::withMessages([
                'token' => __('This invitation is invalid or has already been used.'),
            ]);
        }

        return $member;
    }

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

    private function activate(WorkspaceMember $member, int $userId): void
    {
        $member->update([
            'user_id' => $userId,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
            'invite_token' => null,
        ]);

        // Clears the bell notification for this invite now that it's been
        // acted on — a JSON-path match on the payload rather than a foreign
        // key, since DatabaseNotification's `data` is an opaque blob by
        // design (any notification type can shape it however it needs).
        User::find($userId)?->notifications()
            ->where('data->member_id', $member->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $member->setRelation('user', User::find($userId));

        $this->notifyExistingMembers($member, $userId);
        $this->notifyInviter($member, $userId);
    }

    /**
     * "Existing" — everyone who was already active before this join, minus
     * the person who just joined (the invite-accepted UI flow already covers
     * that for them) and minus the inviter, who gets the more specific
     * InvitationAcceptedNotification instead of this generic broadcast.
     */
    private function notifyExistingMembers(WorkspaceMember $member, int $newUserId): void
    {
        $recipients = User::query()
            ->whereIn('id', $member->workspace->members()
                ->where('status', WorkspaceMemberStatus::Active)
                ->whereNotNull('user_id')
                ->where('user_id', '!=', $newUserId)
                ->when($member->invited_by, fn ($query) => $query->where('user_id', '!=', $member->invited_by))
                ->pluck('user_id'))
            ->get();

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients, new TeamMemberJoinedNotification($member));
        }
    }

    private function notifyInviter(WorkspaceMember $member, int $newUserId): void
    {
        if ($member->invited_by === null || $member->invited_by === $newUserId) {
            return;
        }

        User::find($member->invited_by)?->notify(new InvitationAcceptedNotification($member));
    }
}
