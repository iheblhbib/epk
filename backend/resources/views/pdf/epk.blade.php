<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.5; }
        h1, h2, h3 { font-family: 'DejaVu Sans', sans-serif; font-weight: bold; color: #111; margin: 0 0 6px; }
        h1 { font-size: 26pt; }
        h2 { font-size: 13pt; text-transform: uppercase; letter-spacing: 1px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
        p { margin: 0 0 8px; }
        a { color: #4a3fd6; text-decoration: none; }
        .muted { color: #666; }
        .section { margin-bottom: 18px; }

        /* Hero */
        .hero { text-align: center; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 2px solid #111; }
        .hero-image { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
        .hero-subtitle { font-size: 12pt; color: #444; margin-bottom: 4px; }
        .hero-description { font-size: 10pt; color: #555; max-width: 480px; margin: 6px auto 0; }
        .hero-meta { font-size: 9pt; color: #888; margin-top: 6px; }

        /* Tables used for layout (mPDF's box model is most reliable with tables) */
        table.layout { width: 100%; border-collapse: collapse; }
        table.layout td { vertical-align: top; padding: 0; }
        .col-gap { width: 12px; }

        /* Photos grid */
        .photo-cell { width: 33%; padding: 3px; }
        .photo-cell img { width: 100%; height: 70px; object-fit: cover; border-radius: 2px; }
        .photo-caption { font-size: 7.5pt; color: #888; margin-top: 2px; }

        /* Press */
        .press-item { margin-bottom: 10px; }
        .press-quote { font-style: italic; font-size: 11pt; color: #222; }
        .press-source { font-size: 8.5pt; color: #888; margin-top: 2px; }

        /* Releases */
        .release-cell { width: 50%; padding: 4px; }
        .release-cover { width: 56px; height: 56px; object-fit: cover; border-radius: 2px; }
        .release-title { font-size: 10pt; font-weight: bold; }
        .release-meta { font-size: 8.5pt; color: #888; }

        /* Credits */
        .credit-row td { padding: 2px 0; font-size: 9.5pt; }
        .credit-role { color: #888; width: 45%; }

        /* Contact */
        .contact-row td { padding: 2px 0; font-size: 9.5pt; }
        .contact-label { color: #888; width: 100px; }
    </style>
</head>
<body>

@php
    $heroSection = $sections->firstWhere('type', \App\Enums\SectionType::Hero);
    $heroConfig = $heroSection['config'] ?? [];
@endphp

<div class="hero">
    @if(!empty($heroConfig['profile_image_url']))
        <img class="hero-image" src="{{ $heroConfig['profile_image_url'] }}" alt="">
    @endif
    {{-- ?? before ?: — a missing Hero section leaves $heroConfig empty, and
         plain array access on a missing key ('headline') throws instead of
         just being falsy, so ?: alone never gets the chance to fall back. --}}
    <h1>{{ ($heroConfig['headline'] ?? '') ?: ($artist->name ?? $epk->title) }}</h1>
    @if(!empty($heroConfig['subtitle']))
        <div class="hero-subtitle">{{ $heroConfig['subtitle'] }}</div>
    @endif
    @if(!empty($heroConfig['description']))
        <div class="hero-description">{{ $heroConfig['description'] }}</div>
    @endif
    @if($artist && ($artist->genre || $artist->country))
        <div class="hero-meta">{{ implode(' · ', array_filter([$artist->genre, $artist->city, $artist->country])) }}</div>
    @endif
</div>

@foreach($sections as $section)
    @continue($section['type'] === \App\Enums\SectionType::Hero)
    @php $config = $section['config']; @endphp

    @switch($section['type'])
        @case(\App\Enums\SectionType::Biography)
            @if(!empty($config['html']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    {!! $config['html'] !!}
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Music)
            @if(!empty($config['tracks']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <ol>
                        @foreach($config['tracks'] as $track)
                            <li>{{ $track['title'] }}</li>
                        @endforeach
                    </ol>
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Releases)
            @if(!empty($config['releases']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <table class="layout">
                        @foreach(array_chunk($config['releases'], 2) as $row)
                            <tr>
                                @foreach($row as $release)
                                    <td class="release-cell">
                                        <table class="layout"><tr>
                                            @if(!empty($release['cover_image_url']))
                                                <td style="width: 60px;"><img class="release-cover" src="{{ $release['cover_image_url'] }}" alt=""></td>
                                            @endif
                                            <td>
                                                <div class="release-title">{{ $release['title'] }}</div>
                                                <div class="release-meta">{{ ucfirst($release['type']) }}@if($release['release_date']) &middot; {{ \Illuminate\Support\Carbon::parse($release['release_date'])->format('Y') }}@endif</div>
                                            </td>
                                        </tr></table>
                                    </td>
                                @endforeach
                                @if(count($row) === 1)<td class="release-cell"></td>@endif
                            </tr>
                        @endforeach
                    </table>
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Photos)
            @if(!empty($config['items']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <table class="layout">
                        @foreach(array_chunk(array_slice($config['items'], 0, 9), 3) as $row)
                            <tr>
                                @foreach($row as $photo)
                                    <td class="photo-cell">
                                        <img src="{{ $photo['thumbnail_url'] }}" alt="">
                                        @if(!empty($photo['caption']))
                                            <div class="photo-caption">{{ $photo['caption'] }}</div>
                                        @endif
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </table>
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Press)
            @if(!empty($config['items']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    @foreach($config['items'] as $item)
                        <div class="press-item">
                            @if(!empty($item['quote']))
                                <div class="press-quote">&ldquo;{{ $item['quote'] }}&rdquo;</div>
                            @endif
                            <div class="press-source">&mdash; {{ $item['outlet'] }}@if(!empty($item['author'])), {{ $item['author'] }}@endif</div>
                        </div>
                    @endforeach
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Credits)
            @if(!empty($config['items']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <table class="layout">
                        @foreach($config['items'] as $item)
                            <tr class="credit-row">
                                <td class="credit-role">{{ $item['role'] ?? '' }}</td>
                                <td>{{ $item['name'] ?? '' }}</td>
                            </tr>
                        @endforeach
                    </table>
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::SocialNetworks)
            @if(!empty($config['links']))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <p>
                        @foreach($config['links'] as $link)
                            @if(!empty($link['url']))
                                <a href="{{ $link['url'] }}">{{ ucfirst($link['platform'] ?? '') }}</a>@if(!$loop->last) &nbsp;&middot;&nbsp; @endif
                            @endif
                        @endforeach
                    </p>
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Custom)
            @if(!empty($config['html']) || !empty($config['heading']))
                <div class="section">
                    <h2>{{ ($config['heading'] ?? '') ?: $section['title'] }}</h2>
                    {!! $config['html'] ?? '' !!}
                </div>
            @endif
            @break

        @case(\App\Enums\SectionType::Contact)
            @if(array_filter($config))
                <div class="section">
                    <h2>{{ $section['title'] }}</h2>
                    <table class="layout">
                        @if(!empty($config['booking_email']))
                            <tr class="contact-row"><td class="contact-label">Booking</td><td>{{ $config['booking_email'] }}</td></tr>
                        @endif
                        @if(!empty($config['press_email']))
                            <tr class="contact-row"><td class="contact-label">Press</td><td>{{ $config['press_email'] }}</td></tr>
                        @endif
                        @if(!empty($config['management_email']))
                            <tr class="contact-row"><td class="contact-label">Management</td><td>{{ $config['management_email'] }}</td></tr>
                        @endif
                        @if(!empty($config['website']))
                            <tr class="contact-row"><td class="contact-label">Website</td><td>{{ $config['website'] }}</td></tr>
                        @endif
                        @if(!empty($config['phone']))
                            <tr class="contact-row"><td class="contact-label">Phone</td><td>{{ $config['phone'] }}</td></tr>
                        @endif
                        @if(!empty($config['address']))
                            <tr class="contact-row"><td class="contact-label">Address</td><td>{{ $config['address'] }}</td></tr>
                        @endif
                    </table>
                </div>
            @endif
            @break
    @endswitch
@endforeach

<htmlpagefooter name="epk-footer">
    <div style="font-size: 8pt; color: #999; border-top: 1px solid #eee; padding-top: 4px; text-align: center;">
        {{ $artist->name ?? $epk->title }} &middot; Generated {{ now()->format('F j, Y') }} &middot; {PAGENO} / {nbpg}
    </div>
</htmlpagefooter>
<sethtmlpagefooter name="epk-footer" value="on" />

</body>
</html>
