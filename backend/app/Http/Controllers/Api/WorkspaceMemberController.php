<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorkspaceMemberStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\InviteMemberRequest;
use App\Http\Requests\UpdateMemberRoleRequest;
use App\Http\Resources\WorkspaceMemberResource;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Notifications\WorkspaceInvitationNotification;
use App\Services\AuditLogger;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkspaceMemberController extends Controller
{
    public function index(Workspace $workspace): JsonResponse
    {
        $this->authorize('view', $workspace);

        $members = $workspace->members()->with(['user', 'inviter'])->get();

        return WorkspaceMemberResource::collection($members)->response();
    }

    public function store(InviteMemberRequest $request, Workspace $workspace, PlanLimits $planLimits, AuditLogger $auditLogger): JsonResponse
    {
        if (! $planLimits->canAddTeamMember($workspace)) {
            throw ValidationException::withMessages([
                'email' => __('You\'ve reached the team member limit for your current plan. Upgrade to invite more.'),
            ]);
        }

        $email = $request->validated('email');
        $existingUser = User::whereRaw('lower(email) = ?', [strtolower($email)])->first();

        $alreadyInvited = $existingUser
            ? $workspace->members()->where('user_id', $existingUser->id)->exists()
            : $workspace->members()->whereNull('user_id')
                ->whereRaw('lower(invited_email) = ?', [strtolower($email)])
                ->exists();

        if ($alreadyInvited) {
            throw ValidationException::withMessages([
                'email' => __('This person is already a member or has a pending invitation.'),
            ]);
        }

        $member = $workspace->members()->create([
            'user_id' => $existingUser?->id,
            'invited_email' => $email,
            'invited_by' => $request->user()->id,
            'invite_token' => Str::random(64),
            'role' => $request->validated('role'),
            'status' => WorkspaceMemberStatus::Pending,
        ]);

        $member->load(['user', 'inviter', 'workspace']);

        // An existing user gets both channels (mail + an in-app bell
        // notification) via the normal $user->notify() so it lands in their
        // notifications() relation; someone with no account yet can only be
        // reached by mail, routed on-demand by email address since there's
        // no User row to attach an in-app notification to.
        if ($existingUser) {
            $existingUser->notify(new WorkspaceInvitationNotification($member));
        } else {
            Notification::route('mail', $email)->notify(new WorkspaceInvitationNotification($member));
        }

        $auditLogger->log($request, 'member.invited', $member, ['email' => $email, 'role' => $member->role->value], $workspace->id);

        return (new WorkspaceMemberResource($member))->response()->setStatusCode(201);
    }

    public function update(UpdateMemberRoleRequest $request, Workspace $workspace, WorkspaceMember $member, AuditLogger $auditLogger): JsonResponse
    {
        $member->update(['role' => $request->validated('role')]);

        $auditLogger->log(
            $request,
            'member.role_changed',
            $member,
            ['member' => $member->user?->name ?? $member->invited_email, 'role' => $member->role->value],
            $workspace->id
        );

        return (new WorkspaceMemberResource($member->load(['user', 'inviter'])))->response();
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceMember $member, AuditLogger $auditLogger): JsonResponse
    {
        $this->authorize('removeMember', [$workspace, $member]);

        $auditLogger->log(
            $request,
            'member.removed',
            $member,
            ['member' => $member->user?->name ?? $member->invited_email],
            $workspace->id
        );

        $member->delete();

        return response()->json(['message' => __('Member removed.')]);
    }
}
