<?php

namespace App\Http\Controllers\Api;

use App\Enums\AnalyticsEventType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAnalyticsEventRequest;
use App\Models\Epk;
use App\Services\AnalyticsEventLogger;
use Illuminate\Http\JsonResponse;

class PublicAnalyticsEventController extends Controller
{
    public function __construct(private readonly AnalyticsEventLogger $logger) {}

    /**
     * Unauthenticated — the public EPK page reports its own page views,
     * downloads, and plays here. Scoped to `published` for the same reason
     * as PublicEpkController::show(): an unknown/unpublished slug 404s
     * either way, so this can't be used to probe for a draft EPK's existence.
     */
    public function store(StoreAnalyticsEventRequest $request, string $slug): JsonResponse
    {
        $epk = Epk::query()->published()->where('slug', $slug)->firstOrFail();

        $this->logger->log(
            $request,
            $epk,
            AnalyticsEventType::from($request->validated('type')),
            $request->validated('meta') ?? []
        );

        return response()->json(['message' => __('Recorded.')], 201);
    }
}
