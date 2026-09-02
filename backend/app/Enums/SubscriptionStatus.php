<?php

namespace App\Enums;

// Mirrors the shape of Stripe subscription statuses relevant to this app.
// Trialing is a purely local concept -- Stripe never sees a subscription
// object at all during the trial (see Workspace::booted()), so it isn't a
// status Stripe itself would ever report back via webhook; it only ever
// gets set once, at workspace creation, and only ever gets read out again,
// never written to by anything Stripe-facing.
enum SubscriptionStatus: string
{
    case Trialing = 'trialing';
    case Active = 'active';
    case Canceled = 'canceled';
    case PastDue = 'past_due';
}
