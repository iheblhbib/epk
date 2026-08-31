<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\WorkspaceMember;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * In-app only, same reasoning as EpkPublishedNotification — this is a
 * "heads up" for existing teammates, not something worth an email.
 */
class TeamMemberJoinedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly WorkspaceMember $member) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($notifiable instanceof User && ! $notifiable->wantsNotificationChannel('team_member_joined', 'database')) {
            return [];
        }

        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'team_member_joined',
            'workspace_id' => $this->member->workspace_id,
            'workspace_name' => $this->member->workspace->name,
            'member_name' => $this->member->user?->name,
            'member_role' => $this->member->role->value,
        ];
    }
}
