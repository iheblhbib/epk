<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "Your free trial has ended." Sent once by the daily
 * `billing:trial-reminders` command when a workspace's trial lapses with
 * no paid plan — the workspace is now locked. Mail only, always sent.
 */
class TrialEndedNotification extends Notification
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
            ->subject("Your KORAXX trial for \"{$this->workspace->name}\" has ended")
            ->greeting('Hi there,')
            ->line("The free trial for your workspace \"{$this->workspace->name}\" has ended, and the workspace is now locked.")
            ->line('Everything is still saved — your press kits, media, and team are untouched. Choose a plan to unlock the workspace and pick up where you left off.')
            ->action('Choose a plan', "{$frontendUrl}/billing");
    }
}
