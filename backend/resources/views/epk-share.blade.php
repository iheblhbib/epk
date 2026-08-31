<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="KORAX">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ $redirectUrl }}">
    @if($image)
        <meta property="og:image" content="{{ $image }}">
    @endif

    <meta name="twitter:card" content="{{ $image ? 'summary_large_image' : 'summary' }}">
    <meta name="twitter:title" content="{{ $title }}">
    <meta name="twitter:description" content="{{ $description }}">
    @if($image)
        <meta name="twitter:image" content="{{ $image }}">
    @endif

    {{-- Belt-and-suspenders redirect for an actual browser: the JS runs
         first for anyone with it enabled, the meta-refresh covers anyone
         who doesn't, and the visible link below covers both being blocked.
         None of this reaches a crawler, which only reads the tags above. --}}
    <meta http-equiv="refresh" content="0; url={{ $redirectUrl }}">
    <script>window.location.replace(@json($redirectUrl));</script>
</head>
<body>
    <p>Redirecting to <a href="{{ $redirectUrl }}">{{ $title }}</a>&hellip;</p>
</body>
</html>
