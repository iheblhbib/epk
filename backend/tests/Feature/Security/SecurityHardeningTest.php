<?php

it('sets standard security headers on every response', function () {
    $response = $this->getJson('/api/user');

    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('X-Frame-Options', 'DENY');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
});

it('returns a clean 401 JSON response for an unauthenticated non-XHR request, never a route(login) crash', function () {
    // Deliberately plain get(), not getJson() — this app has no
    // server-rendered login page, but Laravel's own default guest-redirect
    // wiring still points at a named "login" route that doesn't exist here.
    // getJson() sends an Accept: application/json header that makes Laravel
    // skip that redirect path entirely, which is exactly why this exact
    // regression (a real browser navigation, or a bare curl call — e.g.
    // clicking a PDF download link with an expired session) slipped past
    // every other test in this suite. See bootstrap/app.php.
    $response = $this->get('/api/epks/1/pdf');

    $response->assertStatus(401);
    $response->assertHeader('Content-Type', 'application/json');
    $response->assertJson(['message' => 'Unauthenticated.']);
});

it('rate limits repeated login attempts', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertUnprocessable();
    }

    $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
        ->assertStatus(429);
});
