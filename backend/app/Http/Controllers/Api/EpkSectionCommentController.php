<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEpkSectionCommentRequest;
use App\Http\Requests\UpdateEpkSectionCommentRequest;
use App\Http\Resources\EpkSectionCommentResource;
use App\Models\Epk;
use App\Models\EpkSection;
use App\Models\EpkSectionComment;
use Illuminate\Http\JsonResponse;

class EpkSectionCommentController extends Controller
{
    public function index(Epk $epk, EpkSection $section): JsonResponse
    {
        $this->authorize('view', $epk);
        $this->assertBelongsToEpk($epk, $section);

        $comments = $section->comments()->with('user')->oldest()->get();

        return EpkSectionCommentResource::collection($comments)->response();
    }

    public function store(StoreEpkSectionCommentRequest $request, Epk $epk, EpkSection $section): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $section);

        $comment = $section->comments()->create([
            'user_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        $comment->setRelation('user', $request->user());

        return (new EpkSectionCommentResource($comment))->response()->setStatusCode(201);
    }

    public function update(UpdateEpkSectionCommentRequest $request, Epk $epk, EpkSection $section, EpkSectionComment $comment): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $section);
        $this->assertBelongsToSection($section, $comment);

        $comment->update(['body' => $request->validated('body')]);
        $comment->load('user');

        return (new EpkSectionCommentResource($comment))->response();
    }

    public function destroy(Epk $epk, EpkSection $section, EpkSectionComment $comment): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $section);
        $this->assertBelongsToSection($section, $comment);
        $this->authorize('delete', $comment);

        $comment->delete();

        return response()->json(['message' => __('Comment removed.')]);
    }

    private function assertBelongsToEpk(Epk $epk, EpkSection $section): void
    {
        abort_unless($section->epk_id === $epk->id, 404);
    }

    private function assertBelongsToSection(EpkSection $section, EpkSectionComment $comment): void
    {
        abort_unless($comment->epk_section_id === $section->id, 404);
    }
}
