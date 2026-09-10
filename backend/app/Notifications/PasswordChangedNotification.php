<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Security alert: the account password just changed — from Settings or
 * through the reset-link flow. Mail only and always sent (no preference
 * toggle): the whole point is that the account's owner hears about it even
 * if it was someone else who made the change.
 *
 * Not ShouldQueue — synchronous like every notification here, see
 * WorkspaceInvitationNotification for why.
 */
class PasswordChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly ?string $ip = null,
        private readonly ?string $country = null,
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
        $mail = (new MailMessage)
            ->subject('Your KORAXX password was changed')
            ->greeting('Hi there,')
            ->line('The password on your KORAXX account was just changed.');

        if ($this->ip !== null) {
            $mail->line($this->country !== null
                ? "Request from {$this->ip} ({$this->country})."
                : "Request from {$this->ip}.");
        }

        return $mail
            ->line('If this was you, no action is needed.')
            ->line('If it was not you, reset your password immediately and contact support — someone else may have access to your account.');
    }
}
