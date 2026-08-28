<?php

namespace App\Enums;

enum AnalyticsEventType: string
{
    case PageView = 'page_view';
    case Download = 'download';
    case AudioPlay = 'audio_play';
    case VideoPlay = 'video_play';
}
