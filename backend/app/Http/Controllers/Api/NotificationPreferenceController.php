<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// A plain array envelope (not a JsonResource) — the payload is a static
// kind/channel toggle map straight out of config/notification_preferences.php,
// not an Eloquent-backed resource, so a resource class would just be
// ceremony around a foreach.
class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->effectivePreferences($request->user())]);
    }

    public function update(Request $request): JsonResponse
    {
        $schema = config('notification_preferences');

        // Build validation rules straight from the schema so a request can
        // only ever toggle a kind/channel combination that's actually
        // capable of being sent — e.g. there's no "epk_published.mail" to
        // turn on, because that notification never sends mail at all.
        $rules = [];
        foreach ($schema as $kind => $channels) {
            foreach ($channels as $channel) {
                $rules["{$kind}.{$channel}"] = ['sometimes', 'boolean'];
            }
        }

        $validated = $request->validate($rules);

        $user = $request->user();
        $current = $user->notification_preferences ?? [];

        foreach ($validated as $kind => $channels) {
            foreach ($channels as $channel => $enabled) {
                $current[$kind][$channel] = $enabled;
            }
        }

        $user->update(['notification_preferences' => $current]);

        return response()->json(['data' => $this->effectivePreferences($user)]);
    }

    /**
     * @return array<string, array<string, bool>>
     */
    private function effectivePreferences(User $user): array
    {
        $schema = config('notification_preferences');

        $prefs = [];
        foreach ($schema as $kind => $channels) {
            foreach ($channels as $channel) {
                $prefs[$kind][$channel] = $user->wantsNotificationChannel($kind, $channel);
            }
        }

        return $prefs;
    }
}
