<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a workspace's owners and admins when Stripe reports the
 * subscription deleted — it's fully canceled and the workspace is now
 * locked (the access gate blocks on Canceled status). Fired only on the
 * transition into Canceled. Mail only.
 */
class SubscriptionCanceledNotification extends Notification
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
            ->subject("Your KORAXX subscription for \"{$this->workspace->name}\" was canceled")
            ->greeting('Hi there,')
            ->line("The subscription for your workspace \"{$this->workspace->name}\" has been canceled, and the workspace is now locked.")
            ->line('Your press kits, media, and team are all still saved. Re-subscribe any time to unlock the workspace again.')
            ->action('Re-subscribe', "{$frontendUrl}/billing");
    }
}
