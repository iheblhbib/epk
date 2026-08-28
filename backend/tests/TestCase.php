<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Every test simulates a request from the SPA's origin so Sanctum's
     * EnsureFrontendRequestsAreStateful middleware treats it as "stateful"
     * (session/cookie based) the same way real browser requests are,
     * rather than silently skipping session handling in tests.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeader('Referer', config('app.frontend_url'));
    }
}
