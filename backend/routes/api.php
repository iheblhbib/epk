<?php

use App\Http\Controllers\Api\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\Admin\AdminEpkController;
use App\Http\Controllers\Api\Admin\AdminStatsController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\AdminWorkspaceController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ArtistController;
use App\Http\Controllers\Api\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Api\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\Api\Auth\NewPasswordController;
use App\Http\Controllers\Api\Auth\PasswordController;
use App\Http\Controllers\Api\Auth\PasswordResetLinkController;
use App\Http\Controllers\Api\Auth\RegisteredUserController;
use App\Http\Controllers\Api\Auth\VerifyEmailController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\EpkController;
use App\Http\Controllers\Api\EpkSectionController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\PrivateLinkController;
use App\Http\Controllers\Api\PrivatePageController;
use App\Http\Controllers\Api\PublicAnalyticsEventController;
use App\Http\Controllers\Api\PublicEpkController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\WorkspaceController;
use App\Http\Controllers\Api\WorkspaceInvitationController;
use App\Http\Controllers\Api\WorkspaceMemberController;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/register', [RegisteredUserController::class, 'store'])
    ->middleware('throttle:register');

Route::post('/login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('throttle:login');

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])
    ->middleware('throttle:6,1');

Route::post('/reset-password', [NewPasswordController::class, 'store'])
    ->middleware('throttle:6,1');

Route::get('/verify-email/{id}/{hash}', VerifyEmailController::class)
    ->middleware(['signed', 'throttle:6,1'])
    ->name('verification.verify');

// Public, unauthenticated — powers the /epk/{slug} public page.
Route::get('/public/epks/{slug}', [PublicEpkController::class, 'show']);
Route::get('/public/epks/{slug}/downloads/{media}', [PublicEpkController::class, 'downloadFile'])
    ->name('public.epk.download');
Route::post('/public/epks/{slug}/events', [PublicAnalyticsEventController::class, 'store'])
    ->middleware('throttle:120,1');

// Public, unauthenticated — powers the /private/{token} gated page. A
// password check (verify) marks the visitor's session, checked by the
// others; none of this requires the EPK to be published.
Route::get('/private/{token}', [PrivatePageController::class, 'show'])
    ->middleware('throttle:60,1');
Route::post('/private/{token}/verify', [PrivatePageController::class, 'verify'])
    ->middleware('throttle:10,1');
Route::get('/private/{token}/downloads/{media}', [PrivatePageController::class, 'downloadFile'])
    ->name('private.download')
    ->middleware('throttle:60,1');
Route::post('/private/{token}/events', [PrivatePageController::class, 'storeEvent'])
    ->middleware('throttle:120,1');

// Public, unauthenticated — the token itself (64 random chars, only ever
// emailed to the invitee) is the access control, the same way a
// Slack/Notion-style invite link works. This is what lets the frontend
// offer "create a password" / "log in" directly on the invitation page
// rather than bouncing an unauthenticated visitor through /login or
// /register and back. Accepting still requires being authenticated — see
// the accept route inside the auth:sanctum group below.
Route::get('/invitations/{token}', [WorkspaceInvitationController::class, 'show'])
    ->middleware('throttle:20,1');
Route::post('/invitations/{token}/login', [WorkspaceInvitationController::class, 'login'])
    ->middleware('throttle:10,1');
Route::post('/invitations/{token}/register', [WorkspaceInvitationController::class, 'register'])
    ->middleware('throttle:10,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy']);

    Route::post('/email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1');

    Route::put('/user/password', [PasswordController::class, 'update'])
        ->middleware('throttle:6,1');
    Route::put('/user/profile', [UserProfileController::class, 'update']);

    Route::get('/user', function (Request $request) {
        return new UserResource($request->user());
    });

    Route::get('/workspaces', [WorkspaceController::class, 'index']);
    Route::post('/workspaces', [WorkspaceController::class, 'store']);
    Route::get('/workspaces/{workspace}', [WorkspaceController::class, 'show']);
    Route::put('/workspaces/{workspace}', [WorkspaceController::class, 'update']);
    Route::delete('/workspaces/{workspace}', [WorkspaceController::class, 'destroy']);
    Route::post('/workspaces/{workspace}/leave', [WorkspaceController::class, 'leave']);

    Route::get('/workspaces/{workspace}/members', [WorkspaceMemberController::class, 'index']);
    Route::post('/workspaces/{workspace}/members', [WorkspaceMemberController::class, 'store']);
    Route::put('/workspaces/{workspace}/members/{member}', [WorkspaceMemberController::class, 'update']);
    Route::delete('/workspaces/{workspace}/members/{member}', [WorkspaceMemberController::class, 'destroy']);

    Route::post('/invitations/{token}/accept', [WorkspaceInvitationController::class, 'accept'])
        ->middleware('throttle:20,1');

    Route::get('/workspaces/{workspace}/artists', [ArtistController::class, 'index']);
    Route::post('/workspaces/{workspace}/artists', [ArtistController::class, 'store']);
    Route::get('/artists/{artist}', [ArtistController::class, 'show']);
    Route::put('/artists/{artist}', [ArtistController::class, 'update']);
    Route::delete('/artists/{artist}', [ArtistController::class, 'destroy']);

    Route::get('/epks', [EpkController::class, 'index']);
    Route::post('/epks', [EpkController::class, 'store']);
    Route::get('/epks/{epk}', [EpkController::class, 'show']);
    Route::put('/epks/{epk}', [EpkController::class, 'update']);
    Route::delete('/epks/{epk}', [EpkController::class, 'destroy']);
    Route::post('/epks/{epk}/duplicate', [EpkController::class, 'duplicate']);
    Route::post('/epks/{epk}/publish', [EpkController::class, 'publish']);
    Route::post('/epks/{epk}/unpublish', [EpkController::class, 'unpublish']);

    Route::get('/epks/{epk}/sections', [EpkSectionController::class, 'index']);
    Route::post('/epks/{epk}/sections', [EpkSectionController::class, 'store']);
    Route::put('/epks/{epk}/sections/reorder', [EpkSectionController::class, 'reorder']);
    Route::put('/epks/{epk}/sections/{section}', [EpkSectionController::class, 'update']);
    Route::delete('/epks/{epk}/sections/{section}', [EpkSectionController::class, 'destroy']);
    Route::post('/epks/{epk}/sections/{section}/duplicate', [EpkSectionController::class, 'duplicate']);

    Route::get('/epks/{epk}/analytics', [AnalyticsController::class, 'show']);

    Route::get('/epks/{epk}/private-links', [PrivateLinkController::class, 'index']);
    Route::post('/epks/{epk}/private-links', [PrivateLinkController::class, 'store']);
    Route::put('/epks/{epk}/private-links/{privateLink}', [PrivateLinkController::class, 'update']);
    Route::delete('/epks/{epk}/private-links/{privateLink}', [PrivateLinkController::class, 'destroy']);

    Route::get('/workspaces/{workspace}/contacts', [ContactController::class, 'index']);
    Route::post('/workspaces/{workspace}/contacts', [ContactController::class, 'store']);
    Route::get('/workspaces/{workspace}/contacts/export', [ContactController::class, 'export']);
    Route::post('/workspaces/{workspace}/contacts/import', [ContactController::class, 'import'])
        ->middleware('throttle:10,1');
    Route::get('/contacts/{contact}', [ContactController::class, 'show']);
    Route::put('/contacts/{contact}', [ContactController::class, 'update']);
    Route::delete('/contacts/{contact}', [ContactController::class, 'destroy']);

    Route::get('/workspaces/{workspace}/billing', [BillingController::class, 'show']);

    Route::get('/workspaces/{workspace}/media', [MediaController::class, 'index']);
    Route::post('/workspaces/{workspace}/media', [MediaController::class, 'store'])
        ->middleware('throttle:30,1');
    Route::put('/media/{media}', [MediaController::class, 'update']);
    Route::delete('/media/{media}', [MediaController::class, 'destroy']);
    Route::get('/media/{media}/download', [MediaController::class, 'download']);
});

Route::middleware(['auth:sanctum', 'active', 'admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminStatsController::class, 'index']);

    Route::get('/users', [AdminUserController::class, 'index']);
    Route::patch('/users/{user}', [AdminUserController::class, 'update']);

    Route::get('/workspaces', [AdminWorkspaceController::class, 'index']);
    Route::delete('/workspaces/{workspace}', [AdminWorkspaceController::class, 'destroy']);
    Route::patch('/workspaces/{workspace}/subscription', [AdminWorkspaceController::class, 'updateSubscription']);

    Route::get('/epks', [AdminEpkController::class, 'index']);
    Route::post('/epks/{epk}/unpublish', [AdminEpkController::class, 'unpublish']);

    Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
});
