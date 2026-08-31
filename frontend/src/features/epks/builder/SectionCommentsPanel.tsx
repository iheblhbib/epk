import { Loader2, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  useAddSectionComment,
  useDeleteSectionComment,
  useSectionComments,
  useUpdateSectionComment,
} from '@/features/epks/hooks/useSectionComments'
import { formatRelativeTime } from '@/lib/relativeTime'
import { useAuth } from '@/providers/AuthProvider'
import type { EpkSection, EpkSectionComment } from '@/types'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function CommentRow({
  comment,
  epkId,
  sectionId,
  canModerate,
}: {
  comment: EpkSectionComment
  epkId: number
  sectionId: number
  canModerate: boolean
}) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const updateComment = useUpdateSectionComment(epkId, sectionId)
  const deleteComment = useDeleteSectionComment(epkId, sectionId)

  const isAuthor = comment.user?.id === user?.id
  const canDelete = isAuthor || canModerate

  return (
    <div className="flex gap-2.5">
      <Avatar size="sm">
        <AvatarFallback className="bg-primary/10 text-primary">
          {comment.user ? initials(comment.user.name) : '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {comment.user?.name ?? t('epkBuilder.comments.deletedUser')}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(comment.created_at, i18n.resolvedLanguage ?? 'en')}
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} autoFocus />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!draft.trim() || updateComment.isPending}
                onClick={() =>
                  updateComment.mutate(
                    { commentId: comment.id, body: draft.trim() },
                    {
                      onSuccess: () => setIsEditing(false),
                      onError: () => toast.error(t('epkBuilder.comments.updateError')),
                    }
                  )
                }
              >
                {updateComment.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('common.save')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false)
                  setDraft(comment.body)
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap text-foreground">{comment.body}</p>
            {(isAuthor || canDelete) && (
              <div className="flex gap-3">
                {isAuthor && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditing(true)}
                  >
                    {t('common.edit')}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    disabled={deleteComment.isPending}
                    onClick={() =>
                      deleteComment.mutate(comment.id, {
                        onError: () => toast.error(t('epkBuilder.comments.deleteError')),
                      })
                    }
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function SectionCommentsPanel({
  epkId,
  section,
  canModerate,
}: {
  epkId: number
  section: EpkSection | null
  canModerate: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const sectionId = section?.id ?? null
  const { data: comments, isLoading } = useSectionComments(epkId, sectionId)
  const addComment = useAddSectionComment(epkId, sectionId ?? 0)

  if (!section) {
    return (
      <div className="p-4">
        <EmptyState
          icon={MessageSquare}
          title={t('epkBuilder.settingsPanel.noSectionTitle')}
          description={t('epkBuilder.settingsPanel.noSectionDescription')}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : !comments || comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('epkBuilder.comments.empty')}</p>
        ) : (
          comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} epkId={epkId} sectionId={section.id} canModerate={canModerate} />
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          placeholder={t('epkBuilder.comments.placeholder')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim() || addComment.isPending}
            onClick={() =>
              addComment.mutate(draft.trim(), {
                onSuccess: () => setDraft(''),
                onError: () => toast.error(t('epkBuilder.comments.addError')),
              })
            }
          >
            {addComment.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('epkBuilder.comments.post')}
          </Button>
        </div>
      </div>
    </div>
  )
}
