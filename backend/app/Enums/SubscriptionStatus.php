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
    // A renewal charge failed and Stripe is still retrying it. This is a
    // grace state -- the workspace keeps full access (see
    // PlanLimits::hasActiveAccess) while the retries run. How long that
    // lasts is Stripe's own dunning schedule, which MUST be configured to
    // eventually cancel or mark-unpaid the subscription (Dashboard ->
    // Billing -> Manage failed payments) or this grace never ends.
    case PastDue = 'past_due';
    // Stripe exhausted its retries without a successful charge. Terminal
    // for access purposes -- the workspace is locked, same as Canceled,
    // until a new payment succeeds.
    case Unpaid = 'unpaid';
}
