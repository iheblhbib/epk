<?php

namespace App\Services;

use Mews\Purifier\Facades\Purifier;

class RichTextSanitizer
{
    /**
     * Strip anything outside the Biography/Custom editor's own toolbar
     * (headings, bold, italic, links, lists, quotes) — see config/purifier.php's
     * "epk_richtext" profile. Applied server-side regardless of what HTML the
     * client claims to have produced.
     */
    public function clean(string $html): string
    {
        return Purifier::clean($html, 'epk_richtext');
    }
}
