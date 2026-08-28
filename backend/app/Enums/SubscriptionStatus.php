<?php

namespace App\Enums;

// Mirrors the shape of Stripe subscription statuses (a deliberate subset —
// trialing/incomplete/unpaid aren't meaningful until Stripe is actually
// wired up) so swapping in real Stripe webhooks later doesn't need a status
// rename.
enum SubscriptionStatus: string
{
    case Active = 'active';
    case Canceled = 'canceled';
    case PastDue = 'past_due';
}
