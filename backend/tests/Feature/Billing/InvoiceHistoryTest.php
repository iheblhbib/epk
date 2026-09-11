<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Services\StripeBillingService;
use Stripe\Collection;
use Stripe\Invoice;
use Stripe\Service\InvoiceService;
use Stripe\StripeClient;

function fakeInvoice(array $overrides = []): Invoice
{
    return Invoice::constructFrom(array_replace([
        'id' => 'in_test_123',
        'number' => 'INV-0001',
        'status' => 'paid',
        'amount_paid' => 4900,
        'currency' => 'eur',
        'created' => 1_800_000_000,
        'period_start' => 1_797_000_000,
        'period_end' => 1_800_000_000,
        'hosted_invoice_url' => 'https://invoice.stripe.com/i/test_123',
        'invoice_pdf' => 'https://invoice.stripe.com/i/test_123/pdf',
    ], $overrides));
}

it('lists invoices for a workspace with a Stripe customer', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['stripe_customer_id' => 'cus_test_123']);

    $invoiceService = Mockery::mock(InvoiceService::class);
    $invoiceService->shouldReceive('all')
        ->with(['customer' => 'cus_test_123', 'limit' => 12])
        ->andReturn(Collection::constructFrom(['data' => [fakeInvoice()]]));

    // StripeClient::__get('invoices') delegates to getService(), which is
    // what's stubbed here -- mocking __get itself on a Mockery mock is
    // unreliable (see BillingReconcileTest).
    $client = Mockery::mock(StripeClient::class);
    $client->shouldReceive('getService')->with('invoices')->andReturn($invoiceService);

    $invoices = (new StripeBillingService($client))->listInvoices($workspace);

    expect($invoices)->toHaveCount(1)
        ->and($invoices[0])->toBe([
            'number' => 'INV-0001',
            'status' => 'paid',
            'amount_paid' => 4900,
            'currency' => 'eur',
            'created' => 1_800_000_000,
            'period_start' => 1_797_000_000,
            'period_end' => 1_800_000_000,
            'hosted_invoice_url' => 'https://invoice.stripe.com/i/test_123',
            'invoice_pdf' => 'https://invoice.stripe.com/i/test_123/pdf',
        ]);
});

it('returns no invoices for a workspace that has never had a Stripe customer', function () {
    $workspace = Workspace::factory()->create();

    $client = Mockery::mock(StripeClient::class);
    $client->shouldNotReceive('getService');

    $invoices = (new StripeBillingService($client))->listInvoices($workspace);

    expect($invoices)->toBe([]);
});

/** Owner-only workspace, used to exercise the endpoint's own auth + response shape. */
function invoiceEndpointWorkspace(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->subscription()->update(['stripe_customer_id' => 'cus_endpoint_123']);

    return [$workspace, $owner];
}

it('returns the invoice list from the billing invoices endpoint', function () {
    [$workspace, $owner] = invoiceEndpointWorkspace();

    $mock = Mockery::mock(StripeBillingService::class);
    $mock->shouldReceive('listInvoices')->with(Mockery::on(fn ($w) => $w->is($workspace)))->andReturn([
        ['number' => 'INV-0002', 'status' => 'paid', 'amount_paid' => 1200, 'currency' => 'eur', 'created' => 1_800_000_000, 'period_start' => 1_797_000_000, 'period_end' => 1_800_000_000, 'hosted_invoice_url' => 'https://invoice.stripe.com/i/x', 'invoice_pdf' => 'https://invoice.stripe.com/i/x/pdf'],
    ]);
    $this->app->instance(StripeBillingService::class, $mock);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/billing/invoices")
        ->assertOk()
        ->assertJsonPath('data.0.number', 'INV-0002');
});

it('denies a non-member from viewing another workspace\'s invoice history', function () {
    [$workspace] = invoiceEndpointWorkspace();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->getJson("/api/workspaces/{$workspace->id}/billing/invoices")
        ->assertForbidden();
});

it('degrades to an empty, flagged-unavailable list when Stripe errors', function () {
    [$workspace, $owner] = invoiceEndpointWorkspace();

    $mock = Mockery::mock(StripeBillingService::class);
    $mock->shouldReceive('listInvoices')->andThrow(new RuntimeException('stripe unreachable'));
    $this->app->instance(StripeBillingService::class, $mock);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/billing/invoices")
        ->assertOk()
        ->assertExactJson(['data' => [], 'unavailable' => true]);
});
