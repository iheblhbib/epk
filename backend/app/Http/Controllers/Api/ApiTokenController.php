<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Personal access tokens for scripting against this API as yourself — same
// Sanctum guard that already authenticates the SPA's cookie session, just a
// second way in. A token acts with the full authority of the account that
// created it (no read-only/scoped-abilities tier); revoking one only ever
// touches the signed-in user's own tokens, enforced by scoping every query
// here through $request->user()->tokens() rather than the bare model.
//
// The whole feature can be switched off via config('features.api_tokens')
// (FEATURE_API_TOKENS_ENABLED in .env): index()/store() 404 while it's off,
// and App\Http\Middleware\RejectDisabledApiTokens rejects every other API
// call made with an already-issued token, not just these endpoints.
class ApiTokenController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless(config('features.api_tokens'), 404);

        $tokens = $request->user()->tokens()->orderByDesc('created_at')->get();

        return response()->json([
            'data' => $tokens->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at,
                'created_at' => $token->created_at,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(config('features.api_tokens'), 404);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $result = $request->user()->createToken($validated['name']);

        return response()->json([
            'data' => [
                'id' => $result->accessToken->id,
                'name' => $result->accessToken->name,
                'created_at' => $result->accessToken->created_at,
                // Sanctum only ever stores a hash of this — it's returned
                // here, once, and there is no way to retrieve it again after
                // this response.
                'plain_text_token' => $result->plainTextToken,
            ],
        ], 201);
    }

    public function destroy(Request $request, string $tokenId): JsonResponse
    {
        // Deliberately still allowed to revoke while the feature is off —
        // someone should always be able to clean up a token, even a
        // previously issued one, regardless of this switch.
        $deleted = $request->user()->tokens()->where('id', $tokenId)->delete();
        abort_if($deleted === 0, 404);

        return response()->json(['message' => __('API token revoked.')]);
    }
}
