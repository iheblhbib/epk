<?php

namespace App\Notifications;

use App\Models\Workspace;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when a subscription is set to cancel at the end of its current
 * period (the user chose "cancel" in the Stripe portal). The workspace
 * keeps full access until `endsAt` — this is the heads-up so the end
 * doesn't arrive as a surprise lockout. Mail only, always sent.
 */
class SubscriptionCancelScheduledNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        private readonly CarbonInterface $endsAt,
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
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $date = $this->endsAt->format('F j, Y');

        return (new MailMessage)
            ->subject("Your KORAXX subscription for \"{$this->workspace->name}\" ends on {$date}")
            ->greeting('Hi there,')
            ->line("Your subscription for \"{$this->workspace->name}\" is set to cancel. You keep full access until {$date}; after that the workspace is locked until you resubscribe.")
            ->line('Changed your mind? You can turn the cancellation off any time before then and nothing changes.')
            ->action('Manage subscription', "{$frontendUrl}/billing");
    }
}
