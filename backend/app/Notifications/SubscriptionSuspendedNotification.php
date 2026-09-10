<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when Stripe has exhausted its payment retries without a successful
 * charge and moved the subscription to `unpaid` — the grace period is over
 * and the workspace is now locked. The escalation from
 * PaymentFailedNotification ("we're retrying"). Mail only, always sent.
 */
class SubscriptionSuspendedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Workspace $workspace) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject("\"{$this->workspace->name}\" is locked — payment could not be collected")
            ->greeting('Hi there,')
            ->line("We tried the card on file for \"{$this->workspace->name}\" several times over the last few days without success, so the workspace is now locked.")
            ->line('Everything is still saved. Update your payment method and the workspace unlocks as soon as a charge goes through.')
            ->action('Update payment method', "{$frontendUrl}/billing");
    }
}
