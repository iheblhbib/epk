<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StripeBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;

/**
 * Public, unauthenticated — Stripe itself is the caller, so there's no
 * Sanctum session/token to check. Webhook::constructEvent (called inside
 * StripeBillingService) is the actual security control: it verifies the
 * `Stripe-Signature` header against STRIPE_WEBHOOK_SECRET, so a forged POST
 * to this URL without knowing that secret is rejected before any event
 * data is trusted. Not queued, for the same reason nothing else in this
 * app is (see WorkspaceInvitationNotification) — no worker is guaranteed
 * to be running on a plain cPanel host.
 */
class StripeWebhookController extends Controller
{
    public function handle(Request $request, StripeBillingService $stripe): JsonResponse
    {
        try {
            $event = $stripe->constructEvent($request->getContent(), (string) $request->header('Stripe-Signature'));
        } catch (SignatureVerificationException|\UnexpectedValueException $e) {
            Log::warning('Rejected a Stripe webhook with an invalid signature.', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        match ($event->type) {
            'customer.subscription.created', 'customer.subscription.updated' => $stripe->syncFromStripeSubscription(
                $event->data->object
            ),
            'customer.subscription.deleted' => $stripe->handleSubscriptionDeleted($event->data->object),
            default => null,
        };

        return response()->json(['received' => true]);
    }
}
