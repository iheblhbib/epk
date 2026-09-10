<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Security alert sent to the *previous* email address when an account's
 * email is changed — the address that's losing access needs to know, in
 * case the change was made by someone who took over the session. The new
 * address separately gets the normal verification email.
 *
 * Routed on-demand (Notification::route('mail', $oldEmail)) — by the time
 * this sends, the old address is no longer attached to any User row.
 * Mail only, always sent, no preference toggle.
 */
class EmailChangeNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $newEmail,
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
            ->subject('The email on your KORAXX account was changed')
            ->greeting('Hi there,')
            ->line("The email address on your KORAXX account was changed to {$this->maskedNewEmail()}.")
            ->line('You are receiving this at your previous address.');

        if ($this->ip !== null) {
            $mail->line($this->country !== null
                ? "Request from {$this->ip} ({$this->country})."
                : "Request from {$this->ip}.");
        }

        return $mail
            ->line('If you made this change, no action is needed.')
            ->line('If you did not, contact support immediately — someone else may have access to your account.');
    }

    /**
     * Show enough of the new address to be recognizable ("j***@example.com")
     * without printing an address the recipient may not be meant to see in
     * full.
     */
    private function maskedNewEmail(): string
    {
        [$local, $domain] = array_pad(explode('@', $this->newEmail, 2), 2, '');

        if ($domain === '') {
            return $this->newEmail;
        }

        $visible = mb_substr($local, 0, 1);

        return "{$visible}***@{$domain}";
    }
}
