<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;

it('registers a new user and logs them in', function () {
    Notification::fake();

    $response = $this->postJson('/api/register', [
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('data.email', 'ada@example.com');

    $this->assertDatabaseHas('users', ['email' => 'ada@example.com']);

    $user = User::whereEmail('ada@example.com')->first();
    Notification::assertSentTo($user, VerifyEmail::class);

    // assertSuccessful() rather than assertOk(): within one test method the app
    // isn't rebooted between requests, so the auth guard still holds the same
    // in-memory $user instance from registration, and JsonResource reports 201
    // for any model with wasRecentlyCreated=true - a chained-test artifact only,
    // not real behavior (a real second request always resolves a fresh model).
    $this->getJson('/api/user')->assertSuccessful()->assertJsonPath('data.email', 'ada@example.com');
});

it('still creates the account and logs the user in when sending the verification email fails', function () {
    // Simulates a real outage (a dead/misconfigured mailbox, an SMTP host
    // refusing the connection) rather than mocking the exception away --
    // port 1 on localhost is essentially guaranteed to refuse the
    // connection immediately, giving a real TransportException without a
    // slow DNS-timeout wait. A registration flow that 500s outright
    // whenever the mail server hiccups would take down new-user signup
    // for an unrelated, often-transient infrastructure problem.
    config([
        // phpunit.xml forces MAIL_MAILER=array for the rest of the suite
        // (so no test ever really sends mail) -- 'default' has to be
        // overridden too, not just the smtp mailer's own host/port, or
        // Laravel never touches the smtp transport this test means to break.
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => '127.0.0.1',
        'mail.mailers.smtp.port' => 1,
    ]);

    $response = $this->postJson('/api/register', [
        'name' => 'Ada Lovelace',
        'email' => 'ada@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('data.email', 'ada@example.com');
    $this->assertDatabaseHas('users', ['email' => 'ada@example.com']);
    $this->getJson('/api/user')->assertSuccessful()->assertJsonPath('data.email', 'ada@example.com');
});

it('rejects registration with a duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $response = $this->postJson('/api/register', [
        'name' => 'Someone',
        'email' => 'taken@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('rejects registration with a weak or unconfirmed password', function () {
    $this->postJson('/api/register', [
        'name' => 'Someone',
        'email' => 'weak@example.com',
        'password' => 'short',
        'password_confirmation' => 'short',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');

    $this->postJson('/api/register', [
        'name' => 'Someone',
        'email' => 'nocomplexity@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');

    $this->postJson('/api/register', [
        'name' => 'Someone',
        'email' => 'mismatch@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Different456!',
    ])->assertUnprocessable()->assertJsonValidationErrors('password');
});
