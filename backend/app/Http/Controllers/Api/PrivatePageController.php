<?php

namespace App\Http\Controllers\Api;

use App\Enums\AnalyticsEventType;
use App\Enums\EpkStatus;
use App\Enums\SectionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAnalyticsEventRequest;
use App\Http\Resources\PublicEpkResource;
use App\Models\Epk;
use App\Models\EpkSection;
use App\Models\Media;
use App\Models\PrivateLink;
use App\Services\AnalyticsEventLogger;
use App\Services\MusicZipBuilder;
use App\Services\PlanLimits;
use App\Services\PublicSectionConfigResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The unauthenticated side of a private share link — everything a visitor
 * who holds a `/private/{token}` link can do. Reuses PublicEpkResource for
 * the actual EPK payload (same shape the public page gets) since a private
 * link is really "the public page, gated by token + optional password,
 * without requiring the EPK to be published".
 */
class PrivatePageController extends Controller
{
    public function __construct(
        private readonly PublicSectionConfigResolver $resolver,
        private readonly AnalyticsEventLogger $logger,
        private readonly MusicZipBuilder $zipBuilder,
        private readonly PlanLimits $planLimits,
    ) {}

    public function show(Request $request, string $token): JsonResponse
    {
        $link = $this->findActiveLink($token);

        if ($link->requiresPassword() && ! $this->isVerified($request, $link)) {
            return response()->json(['message' => __('A password is required.'), 'requires_password' => true], 401);
        }

        return $this->respondWith($link);
    }

    public function verify(Request $request, string $token): JsonResponse
    {
        $link = $this->findActiveLink($token);

        $request->validate(['password' => ['required', 'string']]);

        if (! $link->checkPassword((string) $request->string('password'))) {
            throw ValidationException::withMessages(['password' => __('Incorrect password.')]);
        }

        $this->markVerified($request, $link);

        return $this->respondWith($link);
    }

    public function storeEvent(StoreAnalyticsEventRequest $request, string $token): JsonResponse
    {
        $link = $this->findActiveLink($token);
        abort_if($link->requiresPassword() && ! $this->isVerified($request, $link), 401);

        $this->logger->log(
            $request,
            $link->epk,
            AnalyticsEventType::from($request->validated('type')),
            $request->validated('meta') ?? [],
            $link
        );

        return response()->json(['message' => __('Recorded.')], 201);
    }

    public function downloadFile(Request $request, string $token, Media $media): StreamedResponse
    {
        $link = $this->findActiveLink($token);
        abort_if($link->requiresPassword() && ! $this->isVerified($request, $link), 401);

        $sections = $link->epk->sections()
            ->whereIn('type', [SectionType::Downloads->value, SectionType::Music->value])
            ->where('is_enabled', true)
            ->get();

        abort_unless($this->allowedMediaIds($sections)->contains($media->id), 404);

        return Storage::disk($media->disk)->download($media->path, $media->original_filename);
    }

    public function downloadAllMusic(Request $request, string $token): StreamedResponse
    {
        $link = $this->findActiveLink($token);
        abort_if($link->requiresPassword() && ! $this->isVerified($request, $link), 401);

        $sections = $link->epk->sections()
            ->where('type', SectionType::Music->value)
            ->where('is_enabled', true)
            ->get();

        $mediaIds = $this->allowedMediaIds($sections);
        abort_if($mediaIds->isEmpty(), 404);

        $mediaItems = Media::whereIn('id', $mediaIds)->get();

        return $this->zipBuilder->stream($mediaItems, Str::slug($link->epk->title).'-music.zip');
    }

    public function downloadAllFiles(Request $request, string $token): StreamedResponse
    {
        $link = $this->findActiveLink($token);
        abort_if($link->requiresPassword() && ! $this->isVerified($request, $link), 401);

        $sections = $link->epk->sections()
            ->where('type', SectionType::Downloads->value)
            ->where('is_enabled', true)
            ->get();

        $mediaIds = $this->allowedMediaIds($sections);
        abort_if($mediaIds->isEmpty(), 404);

        $mediaItems = Media::whereIn('id', $mediaIds)->get();

        return $this->zipBuilder->stream($mediaItems, Str::slug($link->epk->title).'-files.zip');
    }

    /**
     * Same "which media ids are actually attached to an enabled
     * Downloads/Music section" logic as PublicEpkController::downloadFile()
     * -- not extracted to a shared helper since the two controllers query
     * sections differently (an already-loaded relation here vs. eager-loaded
     * there), and this is the entire method.
     *
     * @param  \Illuminate\Database\Eloquent\Collection<int, EpkSection>  $sections
     * @return Collection<int, int>
     */
    private function allowedMediaIds($sections): Collection
    {
        return $sections->flatMap(function ($section) {
            if ($section->type === SectionType::Downloads) {
                return $section->config['media_ids'] ?? [];
            }

            return collect($section->config['tracks'] ?? [])
                ->filter(fn ($track) => ($track['provider'] ?? 'upload') === 'upload')
                ->pluck('audio_media_id')
                ->filter();
        })->map(fn ($id) => (int) $id);
    }

    /**
     * A revoked/expired link 410s explicitly (distinct from "wrong token")
     * — unlike the public page's deliberate everything-404s secrecy, a
     * private link's token is already high-entropy and known only to
     * whoever received it, so saying *why* access ended isn't a meaningful
     * leak and is far more useful to a confused recipient.
     */
    /**
     * A private link is meant to work even for a draft EPK -- that's the
     * whole point (see this class's docblock). But three things make it a
     * dead link the same as revoked/expired: the EPK being archived (it's
     * gone, not just unpublished), the workspace owner's account being
     * suspended, or the workspace's subscription no longer being active
     * (trial expired, canceled, etc.) -- none of which the token itself
     * encodes, so they're checked here on every use rather than baked into
     * the link at creation time.
     */
    private function findActiveLink(string $token): PrivateLink
    {
        $link = PrivateLink::where('token', $token)
            ->with(['epk.workspace.creator', 'epk.workspace.subscription'])
            ->firstOrFail();

        abort_if($link->isRevoked() || $link->isExpired(), 410, __('This link is no longer available.'));
        abort_if($link->epk->status === EpkStatus::Archived, 410, __('This link is no longer available.'));
        abort_if($link->epk->workspace->creator?->suspended_at !== null, 410, __('This link is no longer available.'));
        abort_if(! $this->planLimits->hasActiveAccess($link->epk->workspace), 410, __('This link is no longer available.'));

        return $link;
    }

    private function respondWith(PrivateLink $link): JsonResponse
    {
        $epk = Epk::query()
            ->where('id', $link->epk_id)
            ->with([
                'artist',
                'sections' => fn ($query) => $query->where('is_enabled', true)->orderBy('position'),
            ])
            ->firstOrFail();

        $epk->sections->each(fn ($section) => $section->setRelation('epk', $epk));
        $this->resolver->forPrivateLink($link);
        $link->recordView();

        return (new PublicEpkResource($epk))->response();
    }

    private function sessionKey(PrivateLink $link): string
    {
        return "private_link_verified.{$link->id}";
    }

    private function isVerified(Request $request, PrivateLink $link): bool
    {
        return (bool) $request->session()->get($this->sessionKey($link));
    }

    private function markVerified(Request $request, PrivateLink $link): void
    {
        $request->session()->put($this->sessionKey($link), true);
    }
}
