<?php

namespace App\Enums;

enum WorkspaceRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Editor = 'editor';
    case Viewer = 'viewer';

    /**
     * Roles that may manage workspace settings and invite members.
     */
    public function isAdminLevel(): bool
    {
        return $this === self::Owner || $this === self::Admin;
    }
}
