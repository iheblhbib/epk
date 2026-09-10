<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SendPrivateLinkRequest;
use App\Http\Requests\StorePrivateLinkRequest;
use App\Http\Requests\UpdatePrivateLinkRequest;
use App\Http\Resources\PrivateLinkResource;
use App\Models\Epk;
use App\Models\PrivateLink;
use App\Notifications\PrivateLinkShared;
use App\Services\AuditLogger;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

class PrivateLinkController extends Controller
{
    public function index(Epk $epk): JsonResponse
    {
        $this->authorize('view', $epk);

        return PrivateLinkResource::collection(
            $epk->privateLinks()->with('sends.sender')->latest()->get()
        )->response();
    }

    public function store(StorePrivateLinkRequest $request, Epk $epk, PlanLimits $planLimits): JsonResponse
    {
        // Existing links on a downgraded workspace keep working (checked
        // separately by PrivatePageController) — only creating new ones is
        // gated here.
        if (! $planLimits->canUsePrivateLinks($epk->workspace)) {
            throw ValidationException::withMessages([
                'label' => __('Private links require the Pro plan or higher.'),
            ]);
        }

        $link = new PrivateLink([
            'epk_id' => $epk->id,
            'created_by' => $request->user()->id,
            'label' => $request->validated('label'),
            'expires_at' => $request->validated('expires_at'),
            // Explicit rather than relying on the column's DB-level default
            // — Eloquent doesn't sync that back into the in-memory model
            // after save(), so the immediate response would show null.
            'view_count' => 0,
        ]);
        $link->setPassword($request->validated('password'));
        $link->save();

        return (new PrivateLinkResource($link))->response()->setStatusCode(201);
    }

    public function update(UpdatePrivateLinkRequest $request, Epk $epk, PrivateLink $privateLink): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $privateLink);

        $data = $request->validated();

        if (array_key_exists('password', $data)) {
            $privateLink->setPassword($data['password']);
            unset($data['password']);
        }

        if (array_key_exists('revoked', $data)) {
            $privateLink->revoked_at = $data['revoked'] ? now() : null;
            unset($data['revoked']);
        }

        $privateLink->fill($data);
        $privateLink->save();

        return (new PrivateLinkResource($privateLink))->response();
    }

    public function send(SendPrivateLinkRequest $request, Epk $epk, PrivateLink $privateLink, AuditLogger $auditLogger): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $privateLink);

        if (! $privateLink->isActive()) {
            throw ValidationException::withMessages([
                'recipient_email' => __('This link is revoked or expired — reactivate it before sending.'),
            ]);
        }

        $data = $request->validated();
        $includePassword = ($data['include_password'] ?? false) && $privateLink->requiresPassword();

        if ($includePassword && ! $privateLink->checkPassword((string) ($data['password'] ?? ''))) {
            throw ValidationException::withMessages([
                'password' => __("That's not this link's password."),
            ]);
        }

        $send = $privateLink->sends()->create([
            'sent_by' => $request->user()->id,
            'recipient_email' => $data['recipient_email'],
            'recipient_name' => $data['recipient_name'] ?? null,
            'message' => $data['message'] ?? null,
            'included_password' => $includePassword,
        ]);

        Notification::route('mail', $send->recipient_email)->notify(new PrivateLinkShared(
            $privateLink,
            $send->message,
            $includePassword ? $data['password'] : null,
            $request->user(),
        ));

        $auditLogger->log($request, 'private_link.sent', $privateLink, [
            'recipient_email' => $send->recipient_email,
            'label' => $privateLink->label,
        ], $epk->workspace_id);

        return (new PrivateLinkResource($privateLink->load('sends.sender')))->response();
    }

    public function destroy(Epk $epk, PrivateLink $privateLink): JsonResponse
    {
        $this->authorize('update', $epk);
        $this->assertBelongsToEpk($epk, $privateLink);

        $privateLink->delete();

        return response()->json(['message' => __('Private link deleted.')]);
    }

    private function assertBelongsToEpk(Epk $epk, PrivateLink $link): void
    {
        abort_unless($link->epk_id === $epk->id, 404);
    }
}
