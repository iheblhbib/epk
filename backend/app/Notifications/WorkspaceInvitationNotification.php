<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\WorkspaceMember;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

// Not ShouldQueue: this project's QUEUE_CONNECTION is database-backed, which
// needs a worker process running to ever deliver a queued job. The other
// auth notifications (VerifyEmail, ResetPassword) send synchronously for the
// same reason — mirrored here so an invite email doesn't silently sit
// pending forever on a dev box (or a cPanel host) with no worker running.
class WorkspaceInvitationNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly WorkspaceMember $member) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        // The 'database' channel needs a real Eloquent model to attach the
        // notification to (notifiable_id/notifiable_type) — an invite
        // addressed to someone with no account yet is routed on-demand via
        // Notification::route('mail', $email), where $notifiable is an
        // AnonymousNotifiable, not a User. Mail-only for that case (no
        // account to hold a preference against either); both channels,
        // filtered by the recipient's own preferences, once there's an
        // actual account to show a bell icon on.
        if (! $notifiable instanceof User) {
            return ['mail'];
        }

        return array_values(array_filter([
            $notifiable->wantsNotificationChannel('workspace_invitation', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('workspace_invitation', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $workspace = $this->member->workspace;
        $inviter = $this->member->inviter;
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $url = "{$frontendUrl}/invitations/{$this->member->invite_token}";

        return (new MailMessage)
            ->subject("You've been invited to join {$workspace->name} on KORAX")
            ->greeting('Hi there,')
            ->line($inviter
                ? "{$inviter->name} has invited you to join \"{$workspace->name}\" on KORAX as a {$this->member->role->value}."
                : "You've been invited to join \"{$workspace->name}\" on KORAX as a {$this->member->role->value}.")
            ->action('View invitation', $url)
            ->line('If you were not expecting this invitation, you can safely ignore this email.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $workspace = $this->member->workspace;
        $inviter = $this->member->inviter;

        return [
            // A short, stable discriminator for the frontend to switch on —
            // deliberately separate from Laravel's own `type` column (which
            // stores this class's FQCN) so the payload shape stays decoupled
            // from where the PHP class happens to live.
            'kind' => 'workspace_invitation',
            'member_id' => $this->member->id,
            'workspace_id' => $workspace->id,
            'workspace_name' => $workspace->name,
            'role' => $this->member->role->value,
            'inviter_name' => $inviter?->name,
            'invite_token' => $this->member->invite_token,
        ];
    }
}
