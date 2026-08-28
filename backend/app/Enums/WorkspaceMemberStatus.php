<?php

namespace App\Enums;

enum WorkspaceMemberStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
}
