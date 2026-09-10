<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\WorkspaceMember;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the person who sent an invitation, when it's accepted — the
 * targeted "Jamie joined the workspace you invited them to". Other existing
 * members get the generic in-app-only TeamMemberJoinedNotification instead;
 * the inviter gets this one (which also carries mail) and is excluded from
 * that broadcast so they don't get two bells for the same event.
 */
class InvitationAcceptedNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly WorkspaceMember $member) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return ['mail', 'database'];
        }

        return array_values(array_filter([
            $notifiable->wantsNotificationChannel('invitation_accepted', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('invitation_accepted', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $workspace = $this->member->workspace;
        $who = $this->member->user?->name ?? $this->member->invited_email ?? __('Someone');
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject("{$who} joined {$workspace->name} on KORAXX")
            ->greeting('Hi there,')
            ->line("{$who} accepted your invitation and joined \"{$workspace->name}\" as {$this->member->role->value}.")
            ->action('Open the team', "{$frontendUrl}/team");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $workspace = $this->member->workspace;

        return [
            'kind' => 'invitation_accepted',
            'workspace_id' => $workspace->id,
            'workspace_name' => $workspace->name,
            'member_name' => $this->member->user?->name,
            'member_role' => $this->member->role->value,
        ];
    }
}
