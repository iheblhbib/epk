<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Notifications\AnonymousNotifiable;

it('renders an invitation email linking to the frontend accept page', function () {
    $inviter = User::factory()->create(['name' => 'Jamie Rivers']);
    $workspace = Workspace::factory()->create(['name' => 'Acme Records']);
    $member = WorkspaceMember::factory()->pending()->for($workspace)->create([
        'invited_by' => $inviter->id,
        'invite_token' => 'a-very-random-token',
        'role' => WorkspaceRole::Editor,
        'user_id' => null,
    ]);
    $member->setRelation('inviter', $inviter);
    $member->setRelation('workspace', $workspace);

    $mail = (new WorkspaceInvitationNotification($member))->toMail(new AnonymousNotifiable);
    $rendered = (string) $mail->render();

    expect($rendered)
        ->toContain('Acme Records')
        ->toContain('Jamie Rivers')
        ->toContain('editor')
        ->toContain('http://localhost:5173/invitations/a-very-random-token');
});
