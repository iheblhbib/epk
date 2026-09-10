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
use App\Models\User;
use App\Notifications\PrivateLinkOpenedNotification;
use App\Services\AnalyticsEventLogger;
use App\Services\MusicZipBuilder;
use App\Services\PlanLimits;
use App\Services\PublicSectionConfigResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The unauthenticated side of a private share link — everything a visitor
 * who holds a `/private/{token}` link can do. Reuses PublicEpkResource for
 * the actual EPK payload (same shape the public page gets) since a private
 * link is really "the public page, gated by token + optional password" —
 * it still requires the EPK to be Published, same as the public page does;
 * the difference is only the token + optional password gate on top.
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

        return $this->respondWith($request, $link);
    }

    public function verify(Request $request, string $token): JsonResponse
    {
        $link = $this->findActiveLink($token);

        $request->validate(['password' => ['required', 'string']]);

        if (! $link->checkPassword((string) $request->string('password'))) {
            throw ValidationException::withMessages(['password' => __('Incorrect password.')]);
        }

        $this->markVerified($request, $link);

        return $this->respondWith($request, $link);
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
     * A private link needs its EPK Published, exactly like the public page
     * does -- unpublishing (or never publishing) an EPK disables its private
     * link the same way it disables the public one. A few other things make
     * it a dead link the same as revoked/expired: the EPK being deleted (the
     * dashboard's only "remove this EPK" action -- it soft-deletes, which
     * excludes it from the default `epk()` relation query entirely, so it's
     * eager-loaded with `withTrashed()` here specifically to still have it
     * to check), the workspace owner's account being suspended, or the
     * workspace's subscription no longer being active (trial expired,
     * canceled, etc.) -- none of which the token itself encodes, so they're
     * checked here on every use rather than baked into the link at creation
     * time.
     */
    private function findActiveLink(string $token): PrivateLink
    {
        $link = PrivateLink::where('token', $token)
            ->with([
                'epk' => fn ($query) => $query->withTrashed(),
                'epk.workspace.creator',
                'epk.workspace.subscription',
            ])
            ->firstOrFail();

        abort_if($link->isRevoked() || $link->isExpired(), 410, __('This link is no longer available.'));
        abort_if($link->epk->trashed() || $link->epk->status !== EpkStatus::Published, 410, __('This link is no longer available.'));
        abort_if($link->epk->workspace->creator?->suspended_at !== null, 410, __('This link is no longer available.'));
        abort_if(! $this->planLimits->hasActiveAccess($link->epk->workspace), 410, __('This link is no longer available.'));

        return $link;
    }

    private function respondWith(Request $request, PrivateLink $link): JsonResponse
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

        // Capture "was this the first ever open" before recordView() bumps it —
        // the model was loaded fresh in findActiveLink(), so view_count here is
        // the real pre-increment value.
        $isFirstOpen = $link->view_count === 0;
        $link->recordView();

        if ($isFirstOpen) {
            $link->setRelation('epk', $epk);
            $this->notifyLinkOpened($request, $link);
        }

        return (new PublicEpkResource($epk))->response();
    }

    /**
     * First-open notification to the link's creator plus the workspace's
     * owners and admins (deduped) — editors and viewers are left out.
     */
    private function notifyLinkOpened(Request $request, PrivateLink $link): void
    {
        $recipientIds = $link->epk->workspace->members()
            ->where('status', 'active')
            ->whereNotNull('user_id')
            ->whereIn('role', ['owner', 'admin'])
            ->pluck('user_id')
            ->push($link->created_by)
            ->filter()
            ->unique();

        $recipients = User::query()->whereIn('id', $recipientIds)->get();

        if ($recipients->isEmpty()) {
            return;
        }

        $referer = $request->header('Referer');
        $refererHost = $referer ? parse_url($referer, PHP_URL_HOST) : null;
        $country = $request->server('GEOIP_COUNTRY_CODE') ?: $request->header('CF-IPCountry');
        $country = is_string($country) && strtolower($country) !== 'xx' ? strtoupper(substr($country, 0, 2)) : null;

        Notification::send($recipients, new PrivateLinkOpenedNotification(
            $link,
            $country,
            $refererHost ? strtolower((string) preg_replace('/^www\./', '', $refererHost)) : null,
        ));
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
