<?php

namespace App\Notifications;

use App\Models\Workspace;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A heads-up ~7 days before an annual subscription renews, so the yearly
 * charge doesn't arrive as a surprise. Sent by `billing:renewal-reminders`.
 * Mail only, always sent.
 */
class AnnualRenewalReminderNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        private readonly CarbonInterface $renewsAt,
        private readonly string $planLabel,
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
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $date = $this->renewsAt->format('F j, Y');

        return (new MailMessage)
            ->subject("Your annual KORAXX plan for \"{$this->workspace->name}\" renews on {$date}")
            ->greeting('Hi there,')
            ->line("Your yearly {$this->planLabel} subscription for \"{$this->workspace->name}\" renews on {$date}, and your card on file will be charged then.")
            ->line('Nothing to do if you\'re happy to continue. To change plans, switch to monthly, or cancel, use the billing portal before the renewal date.')
            ->action('Manage subscription', "{$frontendUrl}/billing");
    }
}
