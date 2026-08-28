<?php

namespace App\Notifications;

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
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $workspace = $this->member->workspace;
        $inviter = $this->member->inviter;
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $url = "{$frontendUrl}/invitations/{$this->member->invite_token}";

        return (new MailMessage)
            ->subject("You've been invited to join {$workspace->name} on Kitfolio")
            ->greeting('Hi there,')
            ->line($inviter
                ? "{$inviter->name} has invited you to join \"{$workspace->name}\" on Kitfolio as a {$this->member->role->value}."
                : "You've been invited to join \"{$workspace->name}\" on Kitfolio as a {$this->member->role->value}.")
            ->action('View invitation', $url)
            ->line('If you were not expecting this invitation, you can safely ignore this email.');
    }
}
