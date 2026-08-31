<?php

/*
|--------------------------------------------------------------------------
| Notification Preferences Schema
|--------------------------------------------------------------------------
|
| The channels each notification *kind* is capable of sending on, and thus
| the only channels a user is allowed to toggle for that kind. This is the
| single source of truth for both the backend (User::wantsNotificationChannel
| filters every Notification's via() against it, see
| App\Notifications\*) and the API surface exposed to the frontend
| Settings > Notifications tab — a kind/channel pair not listed here was
| never sent in the first place, so there's nothing to opt out of.
|
| All kinds default to fully enabled — see User::wantsNotificationChannel().
| Adding a new notification kind means adding it here too, or its via()
| filter will find no schema entry and effectively fall back to "always
| on" for every channel it checks.
|
*/

return [
    'workspace_invitation' => ['mail', 'database'],
    'epk_published' => ['database'],
    'team_member_joined' => ['database'],
];
