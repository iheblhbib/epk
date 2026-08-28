<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request) {
                $search = '%'.$request->string('search')->trim().'%';
                $query->where(fn ($q) => $q->where('name', 'like', $search)->orWhere('email', 'like', $search));
            })
            ->when($request->filled('role'), fn ($query) => $query->where('role', $request->string('role')))
            ->orderByDesc('created_at')
            ->paginate(25);

        return UserResource::collection($users)->response();
    }

    public function update(Request $request, User $user, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['sometimes', Rule::enum(UserRole::class)],
            'suspended' => ['sometimes', 'boolean'],
        ]);

        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages([
                'user' => __('You cannot change your own admin status.'),
            ]);
        }

        if (
            array_key_exists('role', $validated)
            && $validated['role'] !== UserRole::Admin->value
            && $user->role === UserRole::Admin
            && User::where('role', UserRole::Admin)->count() <= 1
        ) {
            throw ValidationException::withMessages([
                'role' => __('You cannot remove the last remaining admin.'),
            ]);
        }

        if (array_key_exists('role', $validated)) {
            $user->role = $validated['role'];
            $auditLogger->log($request, 'user.role_changed', $user, ['role' => $validated['role']]);
        }

        if (array_key_exists('suspended', $validated)) {
            $user->suspended_at = $validated['suspended'] ? now() : null;
            $auditLogger->log($request, $validated['suspended'] ? 'user.suspended' : 'user.unsuspended', $user);
        }

        $user->save();

        return (new UserResource($user))->response();
    }
}
