<?php

namespace App\Notifications;

use App\Models\Epk;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "Your EPK is still a draft." Sent once by the daily `epks:draft-nudge`
 * command, roughly a week after an EPK is created if it's never been
 * published. An activation nudge — toggleable (draft_reminder), mail + bell.
 */
class DraftEpkReminderNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Epk $epk) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return ['mail', 'database'];
        }

        return array_values(array_filter([
            $notifiable->wantsNotificationChannel('draft_reminder', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('draft_reminder', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject("\"{$this->epk->title}\" is still a draft")
            ->greeting('Hi there,')
            ->line("Your press kit \"{$this->epk->title}\" has been a draft for about a week. It won't be visible to anyone until you publish it.")
            ->line('When it\'s ready, publishing takes one click — then you get a shareable link and a downloadable PDF.')
            ->action('Open the EPK', "{$frontendUrl}/epks/{$this->epk->id}/builder");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'draft_reminder',
            'epk_id' => $this->epk->id,
            'epk_title' => $this->epk->title,
            'workspace_id' => $this->epk->workspace_id,
        ];
    }
}
