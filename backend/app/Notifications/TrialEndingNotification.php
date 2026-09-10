<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "Your free trial ends in N days." Sent by the daily
 * `billing:trial-reminders` command to a workspace's owners and admins,
 * once at 3 days out and once at 1 day out. Mail only, always sent — a
 * billing deadline isn't something to make opt-out-able.
 *
 * Not ShouldQueue — synchronous like every notification here (no queue
 * worker is guaranteed on shared hosting; see WorkspaceInvitationNotification).
 */
class TrialEndingNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly int $daysLeft,
        private readonly Workspace $workspace,
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
        $when = $this->daysLeft === 1 ? 'tomorrow' : "in {$this->daysLeft} days";

        return (new MailMessage)
            ->subject("Your KORAXX trial for \"{$this->workspace->name}\" ends {$when}")
            ->greeting('Hi there,')
            ->line("The free trial for your workspace \"{$this->workspace->name}\" ends {$when}.")
            ->line('Choose a plan now to keep your press kits online and your team working without interruption.')
            ->action('Choose a plan', "{$frontendUrl}/billing")
            ->line('If you do nothing, the workspace will be locked when the trial ends until a plan is chosen. Your data is kept safe either way.');
    }
}
