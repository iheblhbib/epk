<?php

namespace App\Notifications;

use App\Models\Epk;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * "Your EPK just passed N views." Sent by the daily `epks:view-milestones`
 * command when a published EPK's total page views crosses a threshold it
 * hasn't crossed before. Toggleable (view_milestone), mail + bell.
 */
class ViewMilestoneNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Epk $epk,
        public readonly int $milestone,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return ['mail', 'database'];
        }

        return array_values(array_filter([
            $notifiable->wantsNotificationChannel('view_milestone', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('view_milestone', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $count = number_format($this->milestone);

        return (new MailMessage)
            ->subject("\"{$this->epk->title}\" just passed {$count} views")
            ->greeting('Nice work,')
            ->line("Your press kit \"{$this->epk->title}\" has now been viewed more than {$count} times.")
            ->action('See the analytics', "{$frontendUrl}/epks/{$this->epk->id}/builder");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'view_milestone',
            'epk_id' => $this->epk->id,
            'epk_title' => $this->epk->title,
            'workspace_id' => $this->epk->workspace_id,
            'milestone' => $this->milestone,
        ];
    }
}
