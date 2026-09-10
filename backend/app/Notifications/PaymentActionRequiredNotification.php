<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when a subscription renewal charge is stuck pending 3-D Secure
 * authentication (Stripe's `invoice.payment_action_required`). The
 * cardholder has to open the hosted invoice and confirm with their bank,
 * or the payment fails and the subscription eventually goes past_due.
 * Mail only, always sent.
 */
class PaymentActionRequiredNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        private readonly string $invoiceUrl,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Confirm the payment for \"{$this->workspace->name}\" on KORAXX")
            ->greeting('Hi there,')
            ->line("Your bank needs you to confirm the latest subscription charge for \"{$this->workspace->name}\" — a quick security check (3-D Secure).")
            ->line('Until it\'s confirmed the payment is on hold. It only takes a moment.')
            ->action('Confirm payment', $this->invoiceUrl)
            ->line('If you don\'t confirm it, the payment will fail and the subscription will eventually be suspended.');
    }
}
