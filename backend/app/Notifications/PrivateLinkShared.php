<?php

namespace App\Notifications;

use App\Models\PrivateLink;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent when someone shares a private EPK link by email from the builder.
 * Always mail-only and routed on-demand (Notification::route('mail', ...)) —
 * the recipient is a journalist/booker with no account here, so there's no
 * User to hold a preference against or show a bell icon on.
 *
 * Not ShouldQueue: this project's queue is database-backed with no
 * guaranteed worker on shared hosting, so every notification sends
 * synchronously (see WorkspaceInvitationNotification for the full reasoning).
 */
class PrivateLinkShared extends Notification
{
    use Queueable;

    public function __construct(
        public readonly PrivateLink $privateLink,
        private readonly ?string $message,
        private readonly ?string $password,
        private readonly ?User $sender,
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
        $epk = $this->privateLink->epk;
        $subject = $epk->artist?->name
            ? "{$epk->artist->name} — press kit"
            : "{$epk->title} — press kit";

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $url = "{$frontendUrl}/private/{$this->privateLink->token}";

        $mail = (new MailMessage)
            ->subject($this->sender?->name
                ? "{$this->sender->name} shared a press kit with you: {$subject}"
                : "A press kit was shared with you: {$subject}")
            ->greeting('Hi there,')
            ->line($this->sender?->name
                ? "{$this->sender->name} has shared a private press kit link with you."
                : 'A private press kit link has been shared with you.');

        if ($this->message !== null && $this->message !== '') {
            $mail->line("They added a note: \"{$this->message}\"");
        }

        $mail->action('View the press kit', $url);

        if ($this->password !== null && $this->password !== '') {
            $mail->line("This link is password-protected. Password: {$this->password}");
        }

        if ($this->privateLink->expires_at !== null) {
            $mail->line('This link expires on '.$this->privateLink->expires_at->format('F j, Y').'.');
        }

        return $mail->line('If you were not expecting this, you can safely ignore this email.');
    }
}
