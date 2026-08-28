<?php

namespace App\Enums;

enum EpkStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
