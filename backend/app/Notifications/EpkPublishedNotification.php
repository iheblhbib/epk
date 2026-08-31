<?php

namespace App\Notifications;

use App\Models\Epk;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * In-app only (no mail) — publishing isn't urgent enough to warrant an
 * email the way an invite or a security event is, and a bell notification
 * is enough for teammates to notice their workspace has a new live EPK.
 */
class EpkPublishedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly Epk $epk, private readonly ?User $publisher) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($notifiable instanceof User && ! $notifiable->wantsNotificationChannel('epk_published', 'database')) {
            return [];
        }

        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return [
            'kind' => 'epk_published',
            'epk_id' => $this->epk->id,
            'epk_title' => $this->epk->title,
            'workspace_id' => $this->epk->workspace_id,
            'publisher_name' => $this->publisher?->name,
            'public_url' => "{$frontendUrl}/epk/{$this->epk->slug}",
        ];
    }
}
