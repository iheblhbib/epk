<?php

namespace App\Notifications;

use App\Models\PrivateLink;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent the first time a private share link is opened — to whoever created
 * the link plus the workspace's owners and admins. First-open only: a link
 * handed to several people notifies once, on the earliest view (per-recipient
 * tracking would need a distinct token per recipient, which is out of scope).
 *
 * Not ShouldQueue — synchronous like every other notification here, see
 * WorkspaceInvitationNotification for why.
 */
class PrivateLinkOpenedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly PrivateLink $privateLink,
        private readonly ?string $country = null,
        private readonly ?string $referrerHost = null,
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
            $notifiable->wantsNotificationChannel('private_link_opened', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('private_link_opened', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $epk = $this->privateLink->epk;
        $label = $this->privateLink->label ?: __('a private link');
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        $mail = (new MailMessage)
            ->subject("Your press kit \"{$epk->title}\" was opened")
            ->greeting('Good news,')
            ->line("Someone just opened \"{$epk->title}\" through {$label}.");

        if ($this->country !== null || $this->referrerHost !== null) {
            $mail->line(trim(collect([
                $this->country !== null ? "From: {$this->country}" : null,
                $this->referrerHost !== null ? "Referred by: {$this->referrerHost}" : null,
            ])->filter()->implode(' · ')));
        }

        return $mail->action('Open analytics', "{$frontendUrl}/epks/{$epk->id}/builder");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $epk = $this->privateLink->epk;

        return [
            'kind' => 'private_link_opened',
            'epk_id' => $epk->id,
            'epk_title' => $epk->title,
            'workspace_id' => $epk->workspace_id,
            'private_link_id' => $this->privateLink->id,
            'private_link_label' => $this->privateLink->label,
            'country' => $this->country,
            'referrer_host' => $this->referrerHost,
        ];
    }
}
