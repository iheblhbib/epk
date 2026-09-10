<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a member when they're removed from a workspace. Mail only and
 * always sent — a removed member has no bell to check, and "you no longer
 * have access" isn't something to make opt-out-able.
 */
class MemberRemovedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        private readonly ?string $removedByName,
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
            ->subject("You were removed from {$this->workspace->name} on KORAXX")
            ->greeting('Hi there,')
            ->line($this->removedByName
                ? "{$this->removedByName} removed you from the workspace \"{$this->workspace->name}\". You no longer have access to it."
                : "You were removed from the workspace \"{$this->workspace->name}\" and no longer have access to it.")
            ->line('If you think this was a mistake, contact whoever manages that workspace.');
    }
}
