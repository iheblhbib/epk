<?php

namespace App\Notifications;

use App\Models\Workspace;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to a workspace's owners and admins when the subscription becomes
 * active — either a trial converting to a paid plan, or a past_due
 * subscription recovering after a successful retry (`recovered` tells the
 * two apart). Fired only on the transition into active. Mail only.
 */
class SubscriptionActivatedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private readonly Workspace $workspace,
        public readonly bool $recovered,
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
        $plan = $this->workspace->subscription?->plan->label();

        $mail = (new MailMessage)->greeting('Hi there,');

        if ($this->recovered) {
            $mail->subject("Payment recovered for \"{$this->workspace->name}\"")
                ->line("The card on file was charged successfully — your workspace \"{$this->workspace->name}\" is fully active again.");
        } else {
            $mail->subject("Your KORAXX subscription for \"{$this->workspace->name}\" is active")
                ->line("Your subscription for \"{$this->workspace->name}\"".($plan ? " ({$plan})" : '').' is now active. Thanks for subscribing.');
        }

        return $mail->action('View billing', "{$frontendUrl}/billing");
    }
}
