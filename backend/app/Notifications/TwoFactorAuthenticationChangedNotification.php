<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Security alert: two-factor authentication was turned on or off. The
 * "disabled" case is the one that matters most — an attacker who has the
 * password will disable 2FA to keep access — so it's always sent, mail
 * only, with no preference toggle.
 */
class TwoFactorAuthenticationChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly bool $enabled,
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
        $what = $this->enabled ? 'enabled' : 'disabled';

        $mail = (new MailMessage)
            ->subject("Two-factor authentication was {$what} on your KORAXX account")
            ->greeting('Hi there,')
            ->line("Two-factor authentication was just {$what} on your KORAXX account.");

        if ($this->ip !== null) {
            $mail->line($this->country !== null
                ? "Request from {$this->ip} ({$this->country})."
                : "Request from {$this->ip}.");
        }

        $mail->line('If this was you, no action is needed.');

        return $this->enabled
            ? $mail->line('If it was not you, secure your account now — reset your password and review your login activity.')
            : $mail->line('If it was not you, re-enable two-factor authentication and reset your password immediately — your account may be compromised.');
    }
}
