<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AnalyticsQueryRequest;
use App\Models\Epk;
use App\Services\AnalyticsAggregator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsAggregator $aggregator) {}

    public function show(AnalyticsQueryRequest $request, Epk $epk): JsonResponse
    {
        $to = $request->validated('to')
            ? Carbon::parse($request->validated('to'))->endOfDay()
            : now()->endOfDay();

        $from = $request->validated('from')
            ? Carbon::parse($request->validated('from'))->startOfDay()
            : $to->copy()->subDays(29)->startOfDay();

        return response()->json([
            'data' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                ...$this->aggregator->summarize($epk, $from, $to),
            ],
        ]);
    }
}
