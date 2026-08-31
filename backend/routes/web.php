<?php

use App\Http\Controllers\PublicEpkShareController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/e/{slug}', [PublicEpkShareController::class, 'show'])
    ->middleware('throttle:60,1')
    ->name('epk.share');
