<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a workspace's owners and admins when Stripe reports the
 * subscription as past_due — a card charge failed. Fired only on the
 * transition into past_due (see StripeBillingService), so Stripe's webhook
 * retries don't re-send it. Mail only, always sent.
 */
class PaymentFailedNotification extends Notification
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
            ->subject("Payment failed for \"{$this->workspace->name}\" on KORAXX")
            ->greeting('Hi there,')
            ->line("We couldn't charge the card on file for your workspace \"{$this->workspace->name}\".")
            ->line('Stripe will retry over the next few days. Update your payment method now to avoid losing access when the retries run out.')
            ->action('Update payment method', "{$frontendUrl}/billing")
            ->line('Your press kits stay online while the retries are in progress.');
    }
}
