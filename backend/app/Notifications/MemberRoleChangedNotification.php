<?php

namespace App\Notifications;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a member when their role in a workspace is changed by an owner or
 * admin — a demotion (admin -> viewer) is something you'd want to know
 * about. Mail + in-app, both toggleable.
 */
class MemberRoleChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        public readonly WorkspaceRole $newRole,
        private readonly ?string $changedByName,
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
            $notifiable->wantsNotificationChannel('member_role_changed', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('member_role_changed', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject("Your role in {$this->workspace->name} changed")
            ->greeting('Hi there,')
            ->line($this->changedByName
                ? "{$this->changedByName} changed your role in \"{$this->workspace->name}\" to {$this->newRole->value}."
                : "Your role in \"{$this->workspace->name}\" was changed to {$this->newRole->value}.")
            ->action('Open the workspace', "{$frontendUrl}/team");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'member_role_changed',
            'workspace_id' => $this->workspace->id,
            'workspace_name' => $this->workspace->name,
            'new_role' => $this->newRole->value,
            'changed_by_name' => $this->changedByName,
        ];
    }
}
