<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The weekly per-workspace activity digest, sent by `digest:weekly` on
 * Mondays. Only sent to a workspace that actually had page views in the
 * last 7 days (see SendWeeklyDigests). Toggleable (weekly_digest),
 * mail + bell.
 *
 * @phpstan-type Digest array{page_views: int, unique_visitors: int, downloads: int, previous_page_views: int, top_epk: array{title: string, views: int}|null, top_referrer: string|null}
 */
class WeeklyDigestNotification extends Notification
{
    use Queueable;

    /**
     * @param  Digest  $digest
     */
    public function __construct(
        private readonly Workspace $workspace,
        public readonly array $digest,
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
            $notifiable->wantsNotificationChannel('weekly_digest', 'mail') ? 'mail' : null,
            $notifiable->wantsNotificationChannel('weekly_digest', 'database') ? 'database' : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $d = $this->digest;
        $delta = $d['page_views'] - $d['previous_page_views'];
        $trend = match (true) {
            $delta > 0 => "up {$delta} from the week before",
            $delta < 0 => 'down '.abs($delta).' from the week before',
            default => 'the same as the week before',
        };

        $mail = (new MailMessage)
            ->subject("Your KORAXX week: \"{$this->workspace->name}\"")
            ->greeting('Hi there,')
            ->line("Here's how \"{$this->workspace->name}\" did over the last 7 days:")
            ->line("**{$d['page_views']}** page views ({$trend})")
            ->line("**{$d['unique_visitors']}** unique visitors")
            ->line("**{$d['downloads']}** downloads");

        if ($d['top_epk'] !== null) {
            $mail->line("Top press kit: **{$d['top_epk']['title']}** with {$d['top_epk']['views']} views");
        }

        if ($d['top_referrer'] !== null) {
            $mail->line("Most traffic came from **{$d['top_referrer']}**");
        }

        return $mail->action('Open analytics', "{$frontendUrl}/analytics");
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return [
            'kind' => 'weekly_digest',
            'workspace_id' => $this->workspace->id,
            'workspace_name' => $this->workspace->name,
            'page_views' => $this->digest['page_views'],
            'unique_visitors' => $this->digest['unique_visitors'],
            'downloads' => $this->digest['downloads'],
        ];
    }
}
